fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'omk_ui'
description 'OMK open source NUI kit: panels, forms and menus for FiveM'
version '0.3.0'
repository 'https://github.com/openmemorykit/omk_ui'
license 'MIT'

shared_script 'config.lua'

client_scripts {
  'client/config_export.lua',
  'dist/client.js',
}

server_scripts {
  'server/config_export.lua',
  'dist/server.js',
}

ui_page 'web/index.html'

files {
  'web/index.html',
  'web/assets/*',
  'web/fonts/*',
  'locales/*.json',
  'locales/overrides/*.json',
  'branding/*',
}
