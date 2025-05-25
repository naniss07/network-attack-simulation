document.addEventListener('DOMContentLoaded', () => {
  
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

// Router'ın doğru interface MAC adresini bul (geliştirilmiş)
function getRouterInterfaceMAC(router, nextDevice) {
  if (!router || !nextDevice) return '-';
  if (router.ip && router.mac && typeof router.ip === 'object' && typeof router.mac === 'object') {
    // nextDevice internal ise eth0, DMZ ise eth1
    // Internal: 10.0.x.x, DMZ: 192.168.1.x
    if (nextDevice.ip && typeof nextDevice.ip === 'string') {
      if (nextDevice.ip.startsWith('10.')) return router.mac.eth0;
      if (nextDevice.ip.startsWith('192.168.1.')) return router.mac.eth1;
    }
    // Eğer nextDevice'nin ip'si yoksa, id'sine göre switch ise DMZ mi internal mi bak
    if (nextDevice.type === 'switch' && nextDevice.x > router.x) return router.mac.eth1;
    if (nextDevice.type === 'switch' && nextDevice.x < router.x) return router.mac.eth0;
  }
  return (typeof router.mac === 'object') ? Object.values(router.mac)[0] : router.mac || '-';
}

// Layer 3 cihaz tipleri
const L3_TYPES = ['router', 'client', 'webserver', 'dns', 'attacker'];

function getLayer3MAC(device) {
  if (!device) return '-';
  if (device.type === 'router' && device.mac && typeof device.mac === 'object') {
    // Router için fallback: eth0
    return device.mac.eth0 || Object.values(device.mac)[0];
  }
  return device.mac ? (typeof device.mac === 'object' ? Object.values(device.mac)[0] : device.mac) : '-';
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
  // Layer 3 cihazlar arası geçişleri bul
  const l3Transitions = [];
  let lastL3Idx = 0;
  for (let i = 1; i < path.length; i++) {
    const prev = devices.find(d => d.id === path[lastL3Idx]);
    const curr = devices.find(d => d.id === path[i]);
    if (L3_TYPES.includes(curr.type)) {
      if (L3_TYPES.includes(prev.type)) {
        l3Transitions.push([lastL3Idx, i]);
      }
      lastL3Idx = i;
    }
  }
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
        // Panelde sadece Layer 3 cihazdan bir sonraki Layer 3 cihaza geçişlerde göster
        for (const [fromIdx, toIdx] of l3Transitions) {
          if (hop === fromIdx) {
            let realSrcMAC;
            let realDstMAC;
            const l3From = devices.find(d => d.id === path[fromIdx]);
            const l3To = devices.find(d => d.id === path[toIdx]);
            if (l3From.type === 'router') {
              realSrcMAC = getRouterInterfaceMAC(l3From, l3To);
            } else {
              realSrcMAC = getLayer3MAC(l3From);
            }
            if (l3To.type === 'router') {
              realDstMAC = getRouterInterfaceMAC(l3To, l3From);
            } else {
              realDstMAC = getLayer3MAC(l3To);
            }
            addPacketToPanel({
              srcIP,
              srcMAC: realSrcMAC,
              dstIP,
              dstMAC: realDstMAC,
              protocol,
              content
            });
          }
        }
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
  
  {
    srcIP: '10.0.0.10', srcMAC: 'AA:BB:CC:01',
    dstIP: '192.168.1.53', dstMAC: 'AA:BB:CC:0A',
    protocol: 'DNS', content: 'A kaydı sorgusu'
  },
  
  {
    srcIP: '192.168.1.53', srcMAC: 'AA:BB:CC:0A',
    dstIP: '10.0.0.10', dstMAC: 'AA:BB:CC:01',
    protocol: 'DNS', content: 'A kaydı yanıtı'
  },
  
  {
    srcIP: '10.0.0.10', srcMAC: 'AA:BB:CC:01',
    dstIP: '192.168.1.100', dstMAC: 'AA:BB:CC:09',
    protocol: 'HTTP', content: 'GET /index.html'
  },
  
  {
    srcIP: '192.168.1.100', srcMAC: 'AA:BB:CC:09',
    dstIP: '10.0.0.10', dstMAC: 'AA:BB:CC:01',
    protocol: 'HTTP', content: '200 OK'
  },
  
  {
    srcIP: '10.0.0.10', srcMAC: 'AA:BB:CC:0B',
    dstIP: '192.168.1.100', dstMAC: 'AA:BB:CC:09',
    protocol: 'HTTP', content: 'GET /admin'
  },
  
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
    // Panelde fazladan ekleme yok, sadece hop hop gösterim olacak
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