


function setPool() {
  const pool = document.getElementById("poolSelect").value;
  document.getElementById("pool").textContent = pool;
  alert("Pool cambiato in: " + pool);
}

// Simulazione hash rate (demo)
setInterval(() => {
  const randomHashrate = (Math.random() * 1000).toFixed(2);
  document.getElementById("hashrate").textContent = randomHashrate + " H/s";
}, 2000);
