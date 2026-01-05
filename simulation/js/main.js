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

// Belirli cihaz tiplerinden kaçınarak yol bul (ör. CMD için router kaçınma)
function findPathAvoidingTypes(srcId, dstId, avoidTypesSet) {
  const queue = [[srcId]];
  const visited = new Set();
  while (queue.length > 0) {
    const path = queue.shift();
    const last = path[path.length - 1];
    if (last === dstId) return path;
    visited.add(last);
    for (const [a, b] of links) {
      if (a === last && !visited.has(b)) {
        const nb = devices.find(d => d.id === b);
        if (!nb || (avoidTypesSet.has(nb.type) && b !== dstId)) continue;
        queue.push([...path, b]);
      }
      if (b === last && !visited.has(a)) {
        const na = devices.find(d => d.id === a);
        if (!na || (avoidTypesSet.has(na.type) && a !== dstId)) continue;
        queue.push([...path, a]);
      }
    }
  }
  return null;
}

// Aynı anahtarı paylaşan iki uç arasında 2 atlamalı (src -> switch -> dst) yol bul
function findTwoHopPathViaType(srcId, dstId, requiredType) {
  // src ve dst ile doğrudan bağlı olan aynı tipte bir düğüm ara
  const neighborsOf = (id) => {
    const n = new Set();
    for (const [a,b] of links) {
      if (a === id) n.add(b);
      else if (b === id) n.add(a);
    }
    return n;
  };
  const srcNeighbors = neighborsOf(srcId);
  const dstNeighbors = neighborsOf(dstId);
  for (const nid of srcNeighbors) {
    if (!dstNeighbors.has(nid)) continue;
    const node = devices.find(d => d.id === nid);
    if (node && node.type === requiredType) {
      return [srcId, nid, dstId];
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
    if (d.type === 'switch') return false;
    if (typeof d.mac === 'object') return Object.values(d.mac).includes(mac);
    return d.mac === mac;
  });
}

// ----------------------
//  Basit ARP Tablosu
// ----------------------

// IP -> MAC eşlemesi tutar; ARP Reply paketleri işlendiğinde güncellenir
const arpTable = {};

function clearArpTable() {
  for (const key in arpTable) {
    if (Object.prototype.hasOwnProperty.call(arpTable, key)) {
      delete arpTable[key];
    }
  }
}

function handleArpPacket(packet) {
  // İçerik formatı: "ARP Reply: <IP> is at <MAC>"
  const match = packet.content && packet.content.match(/ARP Reply:\s*([0-9.]+)\s*is at\s*([A-F0-9:]{11,17})/i);
  if (match) {
    const ip = match[1];
    const mac = match[2].toUpperCase();
    arpTable[ip] = mac;
  }
}

function isActiveInterface(ip, mac) {
  // 0.0.0.0 IP veya '-' MAC aktif değil kabul edilir
  if (!ip || ip === '0.0.0.0') return false;
  if (!mac || mac === '-' ) return false;
  return true;
}

// Router'ın doğru interface MAC adresini bul (geliştirilmiş)
function getRouterInterfaceMAC(router, nextDevice) {
  if (!router || !nextDevice) return '-';
  if (router.ip && router.mac && typeof router.ip === 'object' && typeof router.mac === 'object') {
    // nextDevice'nin IP'sine göre doğru interface'i seç
    if (nextDevice.ip && typeof nextDevice.ip === 'string') {
      if (nextDevice.ip.startsWith('10.0.')) {
        return isActiveInterface(router.ip.eth0, router.mac.eth0) ? router.mac.eth0 : '-';
      }
      if (nextDevice.ip.startsWith('192.168.100.')) {
        return isActiveInterface(router.ip.eth2, router.mac.eth2) ? router.mac.eth2 : '-';
      }
      if (nextDevice.ip.startsWith('172.16.')) {
        return isActiveInterface(router.ip.eth1, router.mac.eth1) ? router.mac.eth1 : '-';
      }
      if (nextDevice.ip.startsWith('192.168.1.')) {
        return isActiveInterface(router.ip.eth2, router.mac.eth2) ? router.mac.eth2 : '-';
      }
      if (nextDevice.ip.startsWith('192.168.2.')) {
        return isActiveInterface(router.ip.eth3, router.mac.eth3) ? router.mac.eth3 : '-';
      }
    }
    // Eğer nextDevice'nin ip'si yoksa, id'sine göre switch ise bağlı olduğu cihazlara bak
    if (nextDevice.type === 'switch') {
      // Switch'in MAC tablosundaki ilk MAC adresini kullan
      const firstMAC = Object.keys(nextDevice.macTable || {})[0];
      if (firstMAC) {
        const deviceWithMAC = getDeviceByMAC(firstMAC);
        if (deviceWithMAC && deviceWithMAC.ip) {
          if (deviceWithMAC.ip.startsWith('10.0.')) return isActiveInterface(router.ip.eth0, router.mac.eth0) ? router.mac.eth0 : '-';
          if (deviceWithMAC.ip.startsWith('192.168.100.')) return isActiveInterface(router.ip.eth2, router.mac.eth2) ? router.mac.eth2 : '-';
          if (deviceWithMAC.ip.startsWith('172.16.')) return isActiveInterface(router.ip.eth1, router.mac.eth1) ? router.mac.eth1 : '-';
          if (deviceWithMAC.ip.startsWith('192.168.1.')) return isActiveInterface(router.ip.eth2, router.mac.eth2) ? router.mac.eth2 : '-';
          if (deviceWithMAC.ip.startsWith('192.168.2.')) return isActiveInterface(router.ip.eth3, router.mac.eth3) ? router.mac.eth3 : '-';
        }
      }
      // Konuma göre yedek karar (Altay-Tuna-SCADA iki ağlı): sağ taraf eth2, sol taraf eth0
      if (nextDevice.x > router.x) {
        return isActiveInterface(router.ip.eth2, router.mac.eth2) ? router.mac.eth2 : '-';
      }
      if (nextDevice.x < router.x) {
        return isActiveInterface(router.ip.eth0, router.mac.eth0) ? router.mac.eth0 : '-';
      }
    }
  }
  return (typeof router.mac === 'object') ? (router.mac.eth0 || Object.values(router.mac).find(v => v && v !== '-')) : router.mac || '-';
}

// Layer 3 cihaz tipleri
const L3_TYPES = ['router', 'client', 'webserver', 'dns', 'attacker'];

function getLayer3MAC(device) {
  if (!device) return '-';
  if (device.type === 'router' && device.mac && typeof device.mac === 'object') {
    // Router için fallback: aktif ilk arayüzün MAC'i
    if (device.ip && typeof device.ip === 'object') {
      if (isActiveInterface(device.ip.eth0, device.mac.eth0)) return device.mac.eth0;
      if (isActiveInterface(device.ip.eth2, device.mac.eth2)) return device.mac.eth2;
      if (isActiveInterface(device.ip.eth1, device.mac.eth1)) return device.mac.eth1;
      if (isActiveInterface(device.ip.eth3, device.mac.eth3)) return device.mac.eth3;
    }
    return Object.values(device.mac).find(v => v && v !== '-') || '-';
  }
  return device.mac ? (typeof device.mac === 'object' ? Object.values(device.mac)[0] : device.mac) : '-';
}

function resolveDestMAC(srcDevice, dstDevice) {
  // Önce ARP tablosuna bak
  if (dstDevice && dstDevice.ip && arpTable[dstDevice.ip]) {
    return arpTable[dstDevice.ip];
  }
  return getLayer3MAC(dstDevice);
}

// Yerel olay animasyonu (cihaz üzerinde puls)
function animateLocalEvent({ deviceIP, protocol, content }, callback) {
  const canvas = document.getElementById('networkCanvas');
  const ctx = canvas.getContext('2d');
  const device = getDeviceByIP(deviceIP);
  if (!device) { callback && callback(); return; }

  // Panel kaydı (yerel olduğundan src=dst)
  const mac = getLayer3MAC(device);
  addPacketToPanel({ srcIP: deviceIP, srcMAC: mac, dstIP: deviceIP, dstMAC: mac, protocol: protocol || '', content });

  // OVERLOAD olayı ise cihazı kırmızı (overloaded) işaretle
  if (protocol === 'OVERLOAD') {
    device.overloaded = true;
  }

  let step = 0;
  const steps = 45;
  function drawPulse() {
    renderNetwork();
    const radius = 14 + Math.sin((step/steps) * Math.PI) * 6;
    ctx.save();
    ctx.beginPath();
    ctx.arc(device.x, device.y, radius, 0, 2*Math.PI);
    ctx.fillStyle = '#9b59b6';
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.restore();
    ctx.font = 'bold 12px Segoe UI';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(protocol || 'LOCAL', device.x, device.y+4);
    if (step < steps) {
      step++;
      requestAnimationFrame(drawPulse);
    } else {
      callback && callback();
    }
  }
  drawPulse();
}

// Bağlantı üzerinden adım adım paket animasyonu ve panel güncelleme
// Global animasyon yöneticisi (tüm paketler aynı karede çizilir)
const activeAnimations = [];
let animationRafId = null;

function schedulePacketAnimation({srcIP, srcMAC, dstIP, dstMAC, protocol, content, attack, laneIndex, laneCount}, callback) {
  // Başlangıç gecikmesi desteği (isteğe bağlı)
  const args = { srcIP, srcMAC, dstIP, dstMAC, protocol, content, attack, laneIndex, laneCount };
  const startDelayMs = typeof arguments[0].startDelayMs === 'number' ? arguments[0].startDelayMs : 0;
  if (startDelayMs > 0) {
    setTimeout(() => schedulePacketAnimation(args, callback), startDelayMs);
    return;
  }
  // Kaynak/hedef cihazları belirle
  let src;
  const attacker = devices.find(d => d.type === 'attacker');
  if (attacker && srcMAC === (typeof attacker.mac === 'object' ? Object.values(attacker.mac)[0] : attacker.mac)) {
    src = attacker;
  } else {
    src = getDeviceByIP(srcIP) || getDeviceByMAC(srcMAC);
  }
  let dst = getDeviceByIP(dstIP);
  if (attacker && dstMAC === (typeof attacker.mac === 'object' ? Object.values(attacker.mac)[0] : attacker.mac)) {
    dst = attacker;
  }
  if (!src || !dst) { callback && callback(); return; }

  // CMD paketleri için özel yol bulma mantığı
  let path;
  if (protocol === 'CMD') {
    // CMD paketleri her zaman switch üzerinden gitmelidir (attacker -> switch -> zombie)
    // Önce kesin olarak ortak switch üzerinden 2-hop'u zorla
    const neighborsOf = (id) => {
      const n = new Set();
      for (const [a,b] of links) {
        if (a === id) n.add(b);
        else if (b === id) n.add(a);
      }
      return n;
    };
    const srcNeighbors = neighborsOf(src.id);
    const dstNeighbors = neighborsOf(dst.id);
    
    // Her iki cihazın da bağlı olduğu ortak switch'i bul
    let forcedSwitchId = null;
    for (const nid of srcNeighbors) {
      if (!dstNeighbors.has(nid)) continue;
      const node = devices.find(d => d.id === nid);
      if (node && node.type === 'switch') {
        forcedSwitchId = nid;
        break;
      }
    }
    
    if (forcedSwitchId != null) {
      // Direkt switch üzerinden git: attacker -> switch -> zombie
      path = [src.id, forcedSwitchId, dst.id];
    } else {
      // Ortak switch yoksa, mevcut mantıkla devam et
      path = findTwoHopPathViaType(src.id, dst.id, 'switch')
          || findPathAvoidingTypes(src.id, dst.id, new Set(['router']))
          || findPath(src.id, dst.id);
    }
  } else {
    // Diğer protokoller için normal yol bulma
    path = findPath(src.id, dst.id);
  }
  
  // DEBUG: CMD paketleri için yolu konsola yazdır
  if (protocol === 'CMD' && path) {
    const pathDetails = path.map(id => {
      const d = devices.find(x => x.id === id);
      return d ? `${id}(${d.type})` : id;
    }).join(' → ');
    console.log(`CMD Path: ${pathDetails}`);
  }
  
  if (!path || path.length < 2) { callback && callback(); return; }

  // Layer 3 geçişleri
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

  activeAnimations.push({
    packet: { srcIP, srcMAC, dstIP, dstMAC, protocol, content, attack },
    path,
    hop: 0,
    step: 0,
    stepsPerHop: 60,
    l3Transitions,
    callback,
    laneIndex: typeof laneIndex === 'number' ? laneIndex : 0,
    laneCount: typeof laneCount === 'number' ? laneCount : 1
  });

  ensureAnimationLoop();
}

function ensureAnimationLoop() {
  if (animationRafId == null) {
    animationRafId = requestAnimationFrame(animationLoop);
  }
}

function animationLoop() {
  renderNetwork();
  const canvas = document.getElementById('networkCanvas');
  const ctx = canvas.getContext('2d');

  for (let i = activeAnimations.length - 1; i >= 0; i--) {
    const anim = activeAnimations[i];
    const { path, hop, step, stepsPerHop, packet, l3Transitions, callback } = anim;
    if (hop >= path.length - 1) {
      activeAnimations.splice(i,1);
      callback && callback();
      continue;
    }
    const from = devices.find(d => d.id === path[hop]);
    const to = devices.find(d => d.id === path[hop+1]);
    if (!from || !to) { activeAnimations.splice(i,1); callback && callback(); continue; }

    const t = step / stepsPerHop;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, 2 * Math.PI);
    ctx.fillStyle = packet.attack ? '#e74c3c' : (packet.protocol === 'HTTP' ? '#2d72d9' : '#f5a623');
    ctx.shadowColor = packet.attack ? '#e74c3c' : '#2d72d9';
    ctx.shadowBlur = 8;
    ctx.fill();
    // İnce kontur
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.stroke();
    ctx.restore();
    ctx.font = 'bold 12px Segoe UI';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(packet.protocol || '', x, y+4);

    if (step + 1 < stepsPerHop) {
      anim.step++;
    } else {
      // Hop tamamlandı: panel kaydı gerekiyorsa ekle
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
            if (l3From.type === 'router') {
              realDstMAC = resolveDestMAC(l3From, l3To);
            } else {
              realDstMAC = getLayer3MAC(l3To);
            }
          }
          addPacketToPanel({
            srcIP: packet.srcIP,
            srcMAC: realSrcMAC,
            dstIP: packet.dstIP,
            dstMAC: realDstMAC,
            protocol: packet.protocol,
            content: packet.content
          });
        }
      }
      anim.hop++;
      anim.step = 0;
    }
  }

  if (simulationRunning && activeAnimations.length > 0) {
    animationRafId = requestAnimationFrame(animationLoop);
  } else {
    animationRafId = null;
  }
}

function clearActiveAnimations() {
  activeAnimations.length = 0;
  if (animationRafId != null) {
    // Bir dahaki frame'de loop zaten kendini durduracak; ekstra iptal gerekmiyor
    animationRafId = null;
  }
}

function animatePacketOverPath(args, callback) {
  schedulePacketAnimation(args, callback);
}

// ----------------------
//  Senaryo Tanımları
// ----------------------

// Farklı saldırı / trafik senaryolarını burada tanımlıyoruz.
// Her senaryo, "flow" alanında sıralı paket listesini içerir.

const scenarios = {
  normal: {
    label: 'Normal Trafik',
    flow: [
      // Client'tan DNS Server'a istek
      {
        srcIP: '10.0.0.10', srcMAC: 'AA:BB:CC:01',
        dstIP: '192.168.2.53', dstMAC: 'AA:BB:CC:0A',
        protocol: 'DNS', content: 'A kaydı sorgusu'
      },
      // DNS Server'dan Client'a yanıt
      {
        srcIP: '192.168.2.53', srcMAC: 'AA:BB:CC:0A',
        dstIP: '10.0.0.10', dstMAC: 'AA:BB:CC:01',
        protocol: 'DNS', content: 'A kaydı yanıtı'
      },
      // Client'tan Web Server'a HTTP isteği
      {
        srcIP: '10.0.0.10', srcMAC: 'AA:BB:CC:01',
        dstIP: '192.168.1.100', dstMAC: 'AA:BB:CC:09',
        protocol: 'HTTP', content: 'GET /index.html'
      },
      // Web Server'dan Client'a HTTP yanıtı
      {
        srcIP: '192.168.1.100', srcMAC: 'AA:BB:CC:09',
        dstIP: '10.0.0.10', dstMAC: 'AA:BB:CC:01',
        protocol: 'HTTP', content: '200 OK'
      }
    ]
  },
  dos: {
    label: 'DoS (Tek Kaynak)',
    flow: (() => {
      // Tek client -> hedef webserver'a çok sayıda HTTP paketi
      const bursts = [];
      for (let i = 0; i < 15; i++) {
        bursts.push({
          // DoS topolojisinde saldırgan tek kaynaklı flood üretir
          // Topoloji: setTopologyDoS() içinde attacker:
          // ip: '10.0.0.66', mac: 'AA:BB:CC:0B'
          srcIP: '10.0.0.66', srcMAC: 'AA:BB:CC:0B',
          dstIP: '192.168.1.100', dstMAC: 'AA:BB:CC:09',
          protocol: 'HTTP', content: `FLOOD ${i+1}`,
          attack: true
        });
      }
      // Saldırı sonucunda sunucunun aşırı yüklenmesi – yerel olay
      bursts.push({ type: 'local', deviceIP: '192.168.1.100', protocol: 'OVERLOAD', content: 'Server overload' });
      return bursts;
    })()
  },
  ddos: {
    label: 'DDoS (Botnet)',
    flow: (() => {
      // Botnet senaryosu (eşzamanlı):
      // 1) Attacker -> tüm zombiler (komut) [hafif aralıklı]
      // 2) Tüm zombiler -> Server (flood) [tam eşzamanlı, çoklu dalga]
      const flow = [];
      const zombieIPs = Array.from({ length: 10 }).map((_, i) => `10.0.1.${10 + i}`);
      const zombieMACs = Array.from({ length: 10 }).map((_, i) => `AA:BB:DD:${(i+1).toString().padStart(2,'0')}`);
      const attackerMac = 'AA:BB:DD:00';
      
      // 1) Komut: attacker -> zombiler (hafif aralıklı başlatma, görsel ayrışma için)
      // DİKKAT: Her CMD paketi için protocol='CMD' belirtiliyor
      flow.push(zombieIPs.map((ip, idx) => ({
        srcIP: '10.0.1.5', srcMAC: attackerMac,
        dstIP: ip, dstMAC: zombieMACs[idx],
        protocol: 'CMD', // Bu çok önemli - yol bulma algoritması bunu kullanıyor
        content: `ATTACK_CMD to Zombie ${idx+1}`,
        attack: true,
        startDelayMs: idx * 120
      })));
      
      // 2) Flood: zombiler -> server (tam eşzamanlı, çoklu dalga)
      const FLOOD_WAVE_COUNT = 5; // 1 mevcut + 4 ek dalga
      for (let wave = 1; wave <= FLOOD_WAVE_COUNT; wave++) {
        flow.push(zombieIPs.map((ip, idx) => ({
          srcIP: ip, srcMAC: zombieMACs[idx],
          dstIP: '192.168.1.100', dstMAC: 'AA:BB:CC:09',
          protocol: 'HTTP',
          content: `FLOOD W${wave} Z${idx+1}`,
          attack: true
        })));
      }
      
      flow.push({ type: 'local', deviceIP: '192.168.1.100', protocol: 'OVERLOAD', content: 'Server overload' });
      return flow;
    })()
  },
  dns_spoofing_race: {
    label: 'DNS Spoofing (Race)',
    flow: [
      // 1) Client, gerçek DNS sunucusuna sorgu gönderir
      {
        srcIP: '10.0.0.10', srcMAC: 'AA:BB:CC:01',
        dstIP: '192.168.2.53', dstMAC: 'AA:BB:CC:0A',
        protocol: 'DNS', content: 'example.com? (Query)'
      },
      // 2) Attacker, DNS sunucusu gibi davranıp sahte yanıtı daha önce gönderir (MITM)
      {
        srcIP: '192.168.2.53', srcMAC: 'AA:BB:CC:0B', // Kaynak IP gerçek DNS, MAC attacker
        dstIP: '10.0.0.10', dstMAC: 'AA:BB:CC:01',
        protocol: 'DNS', content: 'example.com -> 6.6.6.6 (Spoofed)'
      },
      // 3) Gerçek DNS sunucusunun geç gelen yanıtı (muhtemelen reddedilecek)
      {
        srcIP: '192.168.2.53', srcMAC: 'AA:BB:CC:0A',
        dstIP: '10.0.0.10', dstMAC: 'AA:BB:CC:01',
        protocol: 'DNS', content: 'example.com -> 192.168.1.100 (Legit)'
      }
    ]
  },
  dns_spoofing_mitm: {
    label: 'DNS Spoofing (MITM)',
    flow: [
      // 0) ARP Poisoning – Client & Router tabloları zehirlenir
      {
        srcIP: '10.0.0.1', srcMAC: 'AA:BB:CC:0B',
        dstIP: '10.0.0.10', dstMAC: 'AA:BB:CC:01',
        protocol: 'ARP', content: 'ARP Reply: 10.0.0.1 is at AA:BB:CC:0B'
      },
      {
        srcIP: '10.0.0.10', srcMAC: 'AA:BB:CC:0B',
        dstIP: '10.0.0.1', dstMAC: 'AA:BB:CC:05',
        protocol: 'ARP', content: 'ARP Reply: 10.0.0.10 is at AA:BB:CC:0B'
      },

      // 1) Client DNS Query – giderken Attacker'a uğrar
      {
        srcIP: '10.0.0.10', srcMAC: 'AA:BB:CC:01',
        dstIP: '192.168.2.53', dstMAC: 'AA:BB:CC:0B', // Attacker MAC (Gateway olarak)
        protocol: 'DNS', content: 'example.com? (Query)'
      },

      // 1b) Attacker, sorguyu Router'a iletir (Layer-2 forward)
      {
        srcIP: '10.0.0.10', srcMAC: 'AA:BB:CC:0B',
        dstIP: '192.168.2.53', dstMAC: 'AA:BB:CC:05', // Router eth0 MAC
        protocol: 'DNS', content: 'example.com? (Forward)'
      },

      // 2a) DNS Server yanıtı önce Router'a gelir
      {
        srcIP: '192.168.2.53', srcMAC: 'AA:BB:CC:0A',
        dstIP: '10.0.0.10', dstMAC: 'AA:BB:CC:0B', // Attacker MAC (MITM - Router, ARP zehiriyle paketi saldırgana yollar)
        protocol: 'DNS', content: 'example.com -> 192.168.1.100 (Legit)'
      },

      // 3) Attacker manipüle edip Client'a gönderir
      {
        srcIP: '192.168.2.53', srcMAC: 'AA:BB:CC:0B',
        dstIP: '10.0.0.10', dstMAC: 'AA:BB:CC:01',
        protocol: 'DNS', content: 'example.com -> 6.6.6.6 (Spoofed)'
      }
    ]
  },
  arp_spoofing: {
    label: 'ARP Spoofing (MITM)',
    flow: [
      // 0) ARP Poisoning – Client 1 & Router tabloları zehirlenir (10.0.0.x network)
      {
        srcIP: '10.0.0.1', srcMAC: 'AA:BB:CC:0B',
        dstIP: '10.0.0.10', dstMAC: 'AA:BB:CC:01',
        protocol: 'ARP', content: 'ARP Reply: 10.0.0.1 is at AA:BB:CC:0B'
      },
      {
        srcIP: '10.0.0.10', srcMAC: 'AA:BB:CC:0B',
        dstIP: '10.0.0.1', dstMAC: 'AA:BB:CC:05',
        protocol: 'ARP', content: 'ARP Reply: 10.0.0.10 is at AA:BB:CC:0B'
      },
      
      // 1) Client 1 -> Web Server HTTP isteği (trafik önce attacker'a gider)
      {
        srcIP: '10.0.0.10', srcMAC: 'AA:BB:CC:01',
        dstIP: '192.168.1.100', dstMAC: 'AA:BB:CC:0B', // Attacker MAC (Gateway olarak)
        protocol: 'HTTP', content: 'GET /login'
      },
      
      // 1b) Attacker, isteği Router'a iletir (Layer-2 forward)
      {
        srcIP: '10.0.0.10', srcMAC: 'AA:BB:CC:0B',
        dstIP: '192.168.1.100', dstMAC: 'AA:BB:CC:05', // Router eth0 MAC
        protocol: 'HTTP', content: 'GET /login (Forward)'
      },
      
      // 2) Web Server yanıtı önce Router'a gelir
      {
        srcIP: '192.168.1.100', srcMAC: 'AA:BB:CC:09',
        dstIP: '192.168.1.1', dstMAC: 'AA:BB:CC:07', // Router eth2 (hedef router)
        protocol: 'HTTP', content: '200 OK (To Router)'
      },
      
      // 2b) Router, ARP zehirlenmesi nedeniyle paketi Attacker'a iletir
      {
        srcIP: '192.168.1.1', srcMAC: 'AA:BB:CC:07',
        dstIP: '10.0.0.10', dstMAC: 'AA:BB:CC:0B', // Attacker MAC (Client 1 yerine)
        protocol: 'HTTP', content: '200 OK (Forward via Attacker)'
      },
      
      // 3) Attacker yanıtı manipüle edip Client 1'e gönderir
      {
        srcIP: '192.168.1.100', srcMAC: 'AA:BB:CC:0B',
        dstIP: '10.0.0.10', dstMAC: 'AA:BB:CC:01',
        protocol: 'HTTP', content: '200 OK (Altered)'
      }
    ]
  },
  ip_spoofing: {
    label: 'IP Spoofing',
    flow: [
      // Attacker, Client 1'in IP'sini taklit ederek Web Server'a istek atıyor (eth0 ağı)
      {
        // Kaynak IP: 10.0.0.10 (Client 1), MAC: attacker (AA:BB:CC:0B)
        srcIP: '10.0.0.10', srcMAC: 'AA:BB:CC:0B',
        dstIP: '192.168.1.100', dstMAC: 'AA:BB:CC:09',
        protocol: 'HTTP', content: 'GET /admin'
      },
      // Web Server'dan sahte Client 1'e (aslında attacker) yanıt
      {
        srcIP: '192.168.1.100', srcMAC: 'AA:BB:CC:09',
        // Hedef IP: 10.0.0.10 (Client 1), MAC: attacker (AA:BB:CC:0B)
        dstIP: '10.0.0.10', dstMAC: 'AA:BB:CC:0B',
        protocol: 'HTTP', content: '403 Forbidden'
      }
    ]
  }
};

// Senaryo açıklamaları
const scenarioDescriptions = {
  normal: {
    definition: 'İstemci, DNS isim çözümleme sürecini tamamladıktan sonra ilgili web sunucusuna HTTP isteği gönderir ve yanıt alır. Paket iletimi ağın doğal hiyerarşisi içerisinde gerçekleşir ve herhangi bir trafik manipülasyonu gözlemlenmez.',
    purpose: 'Ağ ortamındaki olağan veri akışını ve temel paket iletim sürecini göstermek.',
    impact: 'IP ve MAC adres eşleşmeleri düzgündür; ARP tabloları normal iletişim sonucunda dinamik olarak güncellenir.'
  },

  dos: {
    definition: 'Saldırgan, tek bir kaynaktan hedef web sunucusuna çok kısa süre içerisinde yoğun HTTP istekleri göndererek sunucu kaynaklarının (CPU, bellek) tükenmesini ve hizmet kesintisi oluşmasını amaçlar.',
    purpose: 'Hedef sistemin erişilebilirliğini azaltmak veya tamamen hizmet dışı bırakmak.',
    impact: '10.0.0.66 (Attacker) → 192.168.1.100 yönünde yoğun HTTP trafiği oluşur; sunucu tarafında aşırı yük (overload) gözlemlenir.'
  },

  ddos: {
    definition: 'Botnet bünyesindeki çok sayıda zombi istemci, hedef sisteme eş zamanlı HTTP istekleri göndererek ağ bant genişliğini ve sunucu kaynaklarını tüketir. Dağıtık yapı, saldırının tespit edilmesini ve engellenmesini zorlaştırır.',
    purpose: 'Dağıtık yapı sayesinde servis dışı bırakma saldırısının etkinliğini artırmak.',
    impact: '10.0.1.10–10.0.1.19 → 192.168.1.100 yönünde yoğun trafik oluşur; router ve hedef sunucuda trafik yükü belirgin şekilde artar.'
  },

  dns_spoofing_race: {
    definition: 'Saldırgan, istemcinin DNS sorgusuna gerçek sunucudan önce sahte bir DNS yanıtı iletmeyi hedefler. Yarışı kazanması durumunda istemci yanlış IP adresine yönlendirilir.',
    purpose: 'İstemciyi sahte veya kötü niyetli bir hedefe yönlendirmek.',
    impact: 'İstemci, example.com alan adı için gerçek sunucu yerine sahte bir IP adresi (örn. 6.6.6.6) öğrenebilir.'
  },

  dns_spoofing_mitm: {
    definition: 'ARP zehirleme saldırısı ile ağ trafiğini kendi üzerinden geçmeye zorlayan saldırgan, DNS sorgu ve yanıtlarını gerçek zamanlı olarak değiştirerek isim çözümleme sürecini kontrol altına alır.',
    purpose: 'DNS çözümleme sürecini manipüle ederek istemci trafiğini yönlendirmek.',
    impact: 'Gateway MAC adresi saldırgana aitmiş gibi algılanır; DNS yanıtları sahte IP bilgileriyle değiştirilebilir.'
  },

  arp_spoofing: {
    definition: 'Saldırgan, istemci ve router ın ARP tablolarını sahte ARP yanıtları ile zehirleyerek yerel ağ trafiğini kendi cihazı üzerinden yönlendirir ve trafiği izleme veya manipüle etme yeteneği kazanır.',
    purpose: 'Ağ trafiğini araya girerek izlemek veya değiştirmek.',
    impact: '10.0.0.1 ve 10.0.0.10 adresleri için MAC eşleşmeleri saldırganın MAC adresi ile güncellenir.'
  },

  ip_spoofing: {
    definition: 'Saldırgan, oluşturduğu paketlerin kaynak IP alanını güvenilir bir istemci adresi ile değiştirerek kimlik taklidi yapar ve IP tabanlı güvenlik mekanizmalarını aşmayı hedefler.',
    purpose: 'Kimlik gizleme ve IP tabanlı erişim kontrollerini aşma girişimi.',
    impact: '192.168.1.100, gelen isteği 10.0.0.10 adresinden gelmiş gibi algılar.'
  }
};

function renderScenarioInfo(key) {
  const defEl = document.getElementById('scenario-info-definition');
  const purEl = document.getElementById('scenario-info-purpose');
  const impEl = document.getElementById('scenario-info-impact');
  if (!defEl || !purEl || !impEl) return;
  const d = scenarioDescriptions[key];
  if (!d) {
    defEl.textContent = 'Bu senaryo için açıklama tanımlanmadı.';
    purEl.textContent = '—';
    impEl.textContent = '—';
    return;
  }
  defEl.textContent = d.definition;
  purEl.textContent = d.purpose;
  impEl.textContent = d.impact;
}

// Varsayılan senaryo: Normal trafik
let packetFlow = scenarios.normal.flow;

// Senaryo seçimi dropdown'ı dinle
const attackSelectEl = document.getElementById('attackSelect');
if (attackSelectEl) {
  attackSelectEl.addEventListener('change', (e) => {
    const key = e.target.value;
    if (scenarios[key]) {
      packetFlow = scenarios[key].flow;
      simulationRunning = false; // Devam eden animasyonları durdur
      clearArpTable();
      clearOverloadFlags();
      // Topolojiyi senaryoya göre ayarla
      if (key === 'normal' && window.setTopologyDefaultNoAttacker) {
        window.setTopologyDefaultNoAttacker();
      } else if (key === 'dos' && window.setTopologyDoS) {
        window.setTopologyDoS();
      } else if (key === 'ddos' && window.setTopologyDDoS) {
        window.setTopologyDDoS();
      } else if ((key === 'arp_spoofing' || key === 'ip_spoofing') && window.setTopologyDefault) {
        // ARP Spoofing ve IP Spoofing için attacker üst LAN'da (Client 1 ile, eth0 ağı)
        window.setTopologyDefault();
      } else if ((key === 'dns_spoofing_race' || key === 'dns_spoofing_mitm') && window.setTopologyDefault) {
        // DNS Spoofing senaryoları için attacker üst LAN'da (Client 1 ile)
        window.setTopologyDefault();
      } else if (window.setTopologyDefault) {
        window.setTopologyDefault();
      }
      // Paneli temizle ve ağı yeniden çiz
      document.getElementById('packetList').innerHTML = '';
      renderNetwork();
      renderScenarioInfo(key);
    }
  });
}

let simulationRunning = false;

function clearOverloadFlags() {
  if (!Array.isArray(devices)) return;
  devices.forEach(d => { if (d && d.overloaded) delete d.overloaded; });
}

function runPacketFlow(index = 0) {
  if (!simulationRunning || index >= packetFlow.length) return;
  const step = packetFlow[index];
  // Tek paket mi, yoksa paralel paket dizisi mi?
  const packets = Array.isArray(step) ? step : [step];
  // ARP/local adımlarını ayrı ele al
  if (packets.length === 1 && packets[0].type === 'local') {
    const p = packets[0];
    animateLocalEvent({ deviceIP: p.deviceIP, protocol: p.protocol, content: p.content }, () => {
      setTimeout(() => runPacketFlow(index + 1), 800);
    });
    return;
  }
  // Paralel animasyon sayacı
  let remaining = packets.length;
  const onDone = () => {
    remaining--;
    if (remaining === 0) {
      setTimeout(() => runPacketFlow(index + 1), 800);
    }
  };
  // Tüm paketleri (tek veya çoklu) başlat
  const laneCount = packets.length;
  packets.forEach((packet, idx) => {
    if (packet.protocol === 'ARP') {
      handleArpPacket(packet);
    }
    animatePacketOverPath({ ...packet, laneIndex: idx, laneCount }, onDone);
  });
}

document.getElementById('startBtn').onclick = () => {
  document.getElementById('packetList').innerHTML = '';
  clearArpTable();
  clearOverloadFlags();
  clearActiveAnimations();
  simulationRunning = true;
  runPacketFlow(0);
};

document.getElementById('stopBtn').onclick = () => {
  simulationRunning = false;
  clearActiveAnimations();
  renderNetwork();
};

document.getElementById('resetBtn').onclick = () => {
  simulationRunning = false;
  document.getElementById('packetList').innerHTML = '';
  clearArpTable();
  clearOverloadFlags();
  clearActiveAnimations();
  renderNetwork();
}; 

// İlk yüklemede: Normal trafik için saldırganı gizleyen topoloji ile başla
if (window.setTopologyDefaultNoAttacker) {
  window.setTopologyDefaultNoAttacker();
}
// İlk yüklemede bilgi panelini doldur
renderScenarioInfo('normal');