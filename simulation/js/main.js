document.addEventListener('DOMContentLoaded', () => {
  // Sayfa yüklendiğinde renderNetwork çağrılacak
  // Resimlerin yüklenmesi visualization.js'de yönetiliyor
});

// Paket panelini güncelleyen fonksiyon
function addPacketToPanel({srcIP, srcMAC, dstIP, dstMAC, protocol, content}) {
  const list = document.getElementById('packetList');
  const li = document.createElement('li');
  li.innerHTML = `
    <b>Kaynak:</b> ${srcIP} (${srcMAC})<br>
    <b>Hedef:</b> ${dstIP} (${dstMAC})<br>
    <b>Protokol:</b> ${protocol || '-'}<br>
    <b>İçerik:</b> ${content || '-'}
  `;
  list.appendChild(li);
  // Otomatik scroll
  list.scrollTop = list.scrollHeight;
}

// Bağlantı tablosu (links) üzerinden yol bulma (BFS)
function findPath(srcId, dstId) {
  const queue = [[srcId]];
  const visited = new Set();
  while (queue.length > 0) {
    const path = queue.shift();
    const last = path[path.length - 1];
    if (last === dstId) return path;
    visited.add(last);
    for (const [a, b] of links) {
      if (a === last && !visited.has(b)) queue.push([...path, b]);
      if (b === last && !visited.has(a)) queue.push([...path, a]);
    }
  }
  return null;
}

function getDeviceByIP(ip) {
  return devices.find(d => {
    if (typeof d.ip === 'object') return Object.values(d.ip).includes(ip);
    return d.ip === ip;
  });
}

function getDeviceByMAC(mac) {
  return devices.find(d => {
    if (typeof d.mac === 'object') return Object.values(d.mac).includes(mac);
    return d.mac === mac;
  });
}

// Bağlantı üzerinden adım adım paket animasyonu ve panel güncelleme
function animatePacketOverPath({srcIP, srcMAC, dstIP, dstMAC, protocol, content}, callback) {
  const canvas = document.getElementById('networkCanvas');
  const ctx = canvas.getContext('2d');
  // Eğer srcMAC, attacker'ın MAC'i ve srcIP bir client'a aitse, başlangıç noktası attacker olsun
  let src;
  const attacker = devices.find(d => d.type === 'attacker');
  if (attacker && srcMAC === (typeof attacker.mac === 'object' ? Object.values(attacker.mac)[0] : attacker.mac)) {
    src = attacker;
  } else {
    src = getDeviceByIP(srcIP);
  }
  const dst = getDeviceByIP(dstIP);
  if (!src || !dst) { callback && callback(); return; }
  // Yol: cihaz id'leri
  const path = findPath(src.id, dst.id);
  if (!path || path.length < 2) { callback && callback(); return; }
  let hop = 0;
  function nextHop() {
    if (hop >= path.length - 1) { callback && callback(); return; }
    const from = devices.find(d => d.id === path[hop]);
    const to = devices.find(d => d.id === path[hop+1]);
    let step = 0;
    const steps = 60; // Daha yavaş animasyon
    function drawFrame() {
      renderNetwork();
      const t = step / steps;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, 2 * Math.PI);
      ctx.fillStyle = protocol === 'HTTP' ? '#2d72d9' : '#f5a623';
      ctx.shadowColor = '#2d72d9';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.restore();
      ctx.font = 'bold 12px Segoe UI';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(protocol || '', x, y+4);
      if (step < steps) {
        step++;
        requestAnimationFrame(drawFrame);
      } else {
        // Her hop'ta paneli güncelle
        addPacketToPanel({
          srcIP,
          srcMAC: from.mac ? (typeof from.mac === 'object' ? Object.values(from.mac)[0] : from.mac) : '-',
          dstIP,
          dstMAC: to.mac ? (typeof to.mac === 'object' ? Object.values(to.mac)[0] : to.mac) : '-',
          protocol,
          content
        });
        hop++;
        setTimeout(nextHop, 200); // Her hop arası kısa bekleme
      }
    }
    drawFrame();
  }
  nextHop();
}

// Simülasyon akışı: sırayla paket gönder
const packetFlow = [
  // Normal trafik: Client 1 → DNS Server
  {
    srcIP: '10.0.0.10', srcMAC: 'AA:BB:CC:01',
    dstIP: '192.168.1.53', dstMAC: 'AA:BB:CC:0A',
    protocol: 'DNS', content: 'A kaydı sorgusu'
  },
  // DNS yanıtı: DNS Server → Client 1
  {
    srcIP: '192.168.1.53', srcMAC: 'AA:BB:CC:0A',
    dstIP: '10.0.0.10', dstMAC: 'AA:BB:CC:01',
    protocol: 'DNS', content: 'A kaydı yanıtı'
  },
  // Normal trafik: Client 1 → Web Server
  {
    srcIP: '10.0.0.10', srcMAC: 'AA:BB:CC:01',
    dstIP: '192.168.1.100', dstMAC: 'AA:BB:CC:09',
    protocol: 'HTTP', content: 'GET /index.html'
  },
  // Web yanıtı: Web Server → Client 1
  {
    srcIP: '192.168.1.100', srcMAC: 'AA:BB:CC:09',
    dstIP: '10.0.0.10', dstMAC: 'AA:BB:CC:01',
    protocol: 'HTTP', content: '200 OK'
  },
  // Saldırı: Attacker, Client 1 IP'siyle Web Server'a istek atıyor
  {
    srcIP: '10.0.0.10', srcMAC: 'AA:BB:CC:0B',
    dstIP: '192.168.1.100', dstMAC: 'AA:BB:CC:09',
    protocol: 'HTTP', content: 'GET /admin'
  },
  // Web yanıtı: Web Server → (spoofed IP)
  {
    srcIP: '192.168.1.100', srcMAC: 'AA:BB:CC:09',
    dstIP: '10.0.0.10', dstMAC: 'AA:BB:CC:0B',
    protocol: 'HTTP', content: '403 Forbidden'
  }
];

let simulationRunning = false;

function runPacketFlow(index = 0) {
  if (!simulationRunning || index >= packetFlow.length) return;
  const packet = packetFlow[index];
  animatePacketOverPath(packet, () => {
    addPacketToPanel(packet);
    setTimeout(() => runPacketFlow(index + 1), 1200);
  });
}

document.getElementById('startBtn').onclick = () => {
  document.getElementById('packetList').innerHTML = '';
  simulationRunning = true;
  runPacketFlow(0);
};

document.getElementById('stopBtn').onclick = () => {
  simulationRunning = false;
  renderNetwork();
};

document.getElementById('resetBtn').onclick = () => {
  simulationRunning = false;
  document.getElementById('packetList').innerHTML = '';
  renderNetwork();
}; 