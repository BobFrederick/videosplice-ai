module.exports = {
  apps: [
    {
      name: 'splice-backend',
      script: './server/dist/app.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
        WS_PORT: 8081,
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        WHISPER_API_URL: 'http://localhost:3001',
        OLLAMA_API_URL: 'http://localhost:11434'
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'splice-whisper',
      script: './whisper-server.mjs',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      error_file: './logs/whisper-error.log',
      out_file: './logs/whisper-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'splice-frontend',
      script: 'serve',
      args: '-s dist -l 5001',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
}
