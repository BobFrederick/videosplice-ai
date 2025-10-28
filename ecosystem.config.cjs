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
      script: 'npx',
      args: 'serve dist -l 5001 -s',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    // Production instances for internal testing
    {
      name: 'splice-prod-backend',
      script: './server/dist/server/src/app.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        WS_PORT: 4001,
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        WHISPER_API_URL: 'http://localhost:8000',
        OLLAMA_API_URL: 'http://localhost:11434'
      },
      error_file: './logs/prod-backend-error.log',
      out_file: './logs/prod-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'splice-prod-whisper',
      script: './whisper-server.mjs',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      error_file: './logs/prod-whisper-error.log',
      out_file: './logs/prod-whisper-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'splice-prod-frontend',
      script: 'bash',
      args: '-c "npx serve dist -l 3000 -s"',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      error_file: './logs/prod-frontend-error.log',
      out_file: './logs/prod-frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'splice-prod-worker',
      script: './server/dist/server/src/workers/videoProcessor.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        WHISPER_API_URL: 'http://localhost:8000',
        OLLAMA_API_URL: 'http://localhost:11434'
      },
      error_file: './logs/prod-worker-error.log',
      out_file: './logs/prod-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
}
