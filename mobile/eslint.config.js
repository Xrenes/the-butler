// The Expo app has its own lint setup; the web app's config one folder up ignores this folder.
const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([globalIgnores(["dist/*", ".expo/*"]), expoConfig]);
