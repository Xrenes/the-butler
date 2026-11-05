const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// The web app and this app share one copy of the task, date, money and alarm rules.
const sharedDomain = path.resolve(__dirname, "../src/lib/domain");
config.watchFolders = [...(config.watchFolders ?? []), sharedDomain];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  zod: path.resolve(__dirname, "node_modules/zod"),
};
// The "@domain/*" import path comes from tsconfig.json "paths", which Expo's Metro reads.

module.exports = config;
