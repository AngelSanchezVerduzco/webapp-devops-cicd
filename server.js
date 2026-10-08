const app = require("./app");
const { startSocketServer } = require("./socket");

const PORT = process.env.PORT || 80;

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`API escuchando en puerto ${PORT}`);
  });

  // Mismo contenedor / misma BD: protocolo TCP en 6061
  startSocketServer();
}

module.exports = app;
