import ActivityKit
import AlarmKit
import CryptoKit
import ExpoModulesCore
import SwiftUI

/// AlarmKit needs a metadata type for every alarm; The Butler has nothing extra to attach.
struct ButlerAlarmMetadata: AlarmMetadata {}

/// One alarm the app wants, as sent from JavaScript.
struct ButlerAlarmSpec: Record {
  /// The same for the same alarm on every sync, so it always maps to the same AlarmKit id.
  @Field var key: String = ""
  @Field var fireAtMs: Double = 0
  @Field var title: String = ""
  @Field var tint: String? = nil
}

/// What a sync did. Sent back to JavaScript as JSON so the app can show it in Settings.
struct ButlerSyncReport: Encodable {
  var authorization: String
  var scheduled = 0
  var kept = 0
  var cancelled = 0
  /// Keys of the future alarms AlarmKit holds after the sync.
  var activeKeys: [String] = []
  var errors: [String] = []
}

struct WantedAlarm {
  let key: String
  let title: String
  let tint: String?
  let date: Date
}

/**
 Real iPhone alarms through AlarmKit: full screen on the Lock Screen, loud, through silent mode and
 Focus, like the Clock app.

 Deliberately plain: a fixed-time alert with the system Stop button and nothing else. No countdown,
 no snooze button and no custom intents, because AlarmKit expects a Live Activity widget for
 countdowns (its snooze uses one) and can drop an alarm before it alerts when that widget is
 missing. Snooze, done and on hold are handled in the app.

 Alarms are reconciled, not re-created: each one has a stable id derived from its key, so a sync
 only cancels alarms the app no longer wants and only schedules the ones that are missing.
 */
public class ButlerAlarmsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ButlerAlarms")

    Function("authorizationStatus") { () -> String in
      ButlerAlarmsModule.authorization()
    }

    AsyncFunction("requestAuthorization") { () async -> String in
      if ButlerAlarmsModule.authorization() == "notDetermined" {
        _ = try? await AlarmManager.shared.requestAuthorization()
      }
      return ButlerAlarmsModule.authorization()
    }

    AsyncFunction("sync") { (specs: [ButlerAlarmSpec]) async -> String in
      await ButlerAlarmsModule.sync(specs)
    }

    AsyncFunction("cancelAll") { () -> Int in
      ButlerAlarmsModule.cancelAll()
    }
  }

  static func authorization() -> String {
    switch AlarmManager.shared.authorizationState {
    case .authorized:
      return "authorized"
    case .denied:
      return "denied"
    case .notDetermined:
      return "notDetermined"
    @unknown default:
      return "notDetermined"
    }
  }

  /// A stable UUID for an alarm key: the first 16 bytes of its SHA-256, with UUID version bits set.
  static func alarmId(for key: String) -> UUID {
    var bytes = Array(SHA256.hash(data: Data(key.utf8)).prefix(16))
    bytes[6] = (bytes[6] & 0x0F) | 0x50
    bytes[8] = (bytes[8] & 0x3F) | 0x80
    return UUID(uuid: (
      bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
      bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]
    ))
  }

  static func color(from hex: String?) -> Color {
    let fallback = Color(red: 0.85, green: 0.19, blue: 0.21)
    guard let hex, let value = UInt64(hex.replacingOccurrences(of: "#", with: ""), radix: 16) else {
      return fallback
    }
    return Color(
      red: Double((value >> 16) & 0xFF) / 255,
      green: Double((value >> 8) & 0xFF) / 255,
      blue: Double(value & 0xFF) / 255
    )
  }

  static func configuration(for alarm: WantedAlarm) -> AlarmManager.AlarmConfiguration<ButlerAlarmMetadata> {
    let alert = AlarmPresentation.Alert(title: LocalizedStringResource(stringLiteral: alarm.title))
    let attributes = AlarmAttributes<ButlerAlarmMetadata>(
      presentation: AlarmPresentation(alert: alert),
      metadata: ButlerAlarmMetadata(),
      tintColor: color(from: alarm.tint)
    )
    return AlarmManager.AlarmConfiguration<ButlerAlarmMetadata>(
      countdownDuration: nil,
      schedule: .fixed(alarm.date),
      attributes: attributes,
      stopIntent: nil,
      secondaryIntent: nil,
      sound: .default
    )
  }

  /// Makes AlarmKit hold exactly the wanted future alarms. Wanted alarms whose time has just passed
  /// are left alone, so an alarm that is ringing right now is never cancelled by a sync.
  static func sync(_ specs: [ButlerAlarmSpec]) async -> String {
    var report = ButlerSyncReport(authorization: authorization())
    guard report.authorization == "authorized" else { return encode(report) }

    let manager = AlarmManager.shared
    let now = Date()
    var wanted: [UUID: WantedAlarm] = [:]
    for spec in specs {
      let alarm = WantedAlarm(
        key: spec.key,
        title: spec.title,
        tint: spec.tint,
        date: Date(timeIntervalSince1970: spec.fireAtMs / 1000)
      )
      wanted[alarmId(for: spec.key)] = alarm
    }

    var existing = Set<UUID>()
    do {
      existing = try Set(manager.alarms.map { $0.id })
    } catch {
      report.errors.append("Could not read the scheduled alarms: \(error.localizedDescription)")
    }

    // 1. Add the missing alarms first, so an edited alarm is never left without its replacement.
    let upcoming = wanted.filter { $0.value.date > now }.sorted { $0.value.date < $1.value.date }
    var failed: [(id: UUID, alarm: WantedAlarm)] = []
    for (id, alarm) in upcoming {
      if existing.contains(id) {
        report.kept += 1
        report.activeKeys.append(alarm.key)
        continue
      }
      do {
        _ = try await manager.schedule(id: id, configuration: configuration(for: alarm))
        report.scheduled += 1
        report.activeKeys.append(alarm.key)
      } catch {
        failed.append((id: id, alarm: alarm))
      }
    }

    // 2. Then remove the alarms the app no longer wants.
    for id in existing where wanted[id] == nil {
      do {
        try manager.cancel(id: id)
        report.cancelled += 1
      } catch {
        report.errors.append("Could not cancel an old alarm: \(error.localizedDescription)")
      }
    }

    // 3. Retry what failed, now that old alarms are gone (AlarmKit limits how many an app holds).
    for (id, alarm) in failed {
      do {
        _ = try await manager.schedule(id: id, configuration: configuration(for: alarm))
        report.scheduled += 1
        report.activeKeys.append(alarm.key)
      } catch {
        report.errors.append("\(alarm.title): \(error.localizedDescription)")
      }
    }
    return encode(report)
  }

  static func cancelAll() -> Int {
    let manager = AlarmManager.shared
    guard let alarms = try? manager.alarms else { return 0 }
    var cancelled = 0
    for alarm in alarms {
      do {
        try manager.cancel(id: alarm.id)
        cancelled += 1
      } catch {
        continue
      }
    }
    return cancelled
  }

  static func encode<T: Encodable>(_ value: T) -> String {
    guard let data = try? JSONEncoder().encode(value), let json = String(data: data, encoding: .utf8) else {
      return "{}"
    }
    return json
  }
}
