module.exports = {
  apps: [
    {
      name: "ennodelabs",
      script: "npm",
      args: "start",
      env: {
        PORT: 3001,
        NODE_ENV: "production"
      },
      env_production: {
        PORT: 3001,
        NODE_ENV: "production"
      }
    }
  ]
};
