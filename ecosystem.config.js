module.exports = {
  apps: [
    {
      name: 'aquarium-v2',
      // tsx runs TypeScript directly - no separate compile step needed
      script: '/var/www/aquarium-autobattle/v2/node_modules/.bin/tsx',
      args: 'src/index.ts',
      cwd: '/var/www/aquarium-autobattle/v2/apps/server',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3101
      },
      error_file: '/var/www/aquarium-autobattle/logs/v2-error.log',
      out_file: '/var/www/aquarium-autobattle/logs/v2-out.log',
      time: true
    }
  ]
};
