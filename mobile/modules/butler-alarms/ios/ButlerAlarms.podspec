Pod::Spec.new do |s|
  s.name           = 'ButlerAlarms'
  s.version        = '1.0.0'
  s.summary        = 'Real iPhone alarms (AlarmKit) for The Butler'
  s.description    = 'Keeps AlarmKit alarms in step with The Butler tasks: fixed-time alerts that ring through silent mode and Focus.'
  s.license        = 'MIT'
  s.author         = 'The Butler'
  s.homepage       = 'https://github.com/Xrenes/the-butler'
  # AlarmKit needs iOS 26; the plain alert (system Stop button) needs 26.1.
  s.platforms      = { :ios => '26.1' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/Xrenes/the-butler' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_INCLUDE_PATHS' => '$(inherited) $(PODS_CONFIGURATION_BUILD_DIR)/ExpoModulesCore',
    'HEADER_SEARCH_PATHS' => '$(inherited) "$(PODS_ROOT)/Headers/Public/ExpoModulesCore"',
  }

  s.source_files = 'ButlerAlarmsModule.swift'
end
