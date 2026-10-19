// ---------- Short, replayable guides for every mode (spec v1.5, item 5) ----------
const MODE_GUIDES = Object.freeze({
  compare: [{ title: '⚖️ 比較頁', html: '三隻動物在<b>同一張地圖、同一個起點</b>一起跑。按「▶ 播放」或「⏩ 跳到結果」，看折線圖和結果表（👑＝最好）。', finishLabel: '開始比較' }],
  challenge: [{ title: '🏆 挑戰頁', html: '🔮 預測誰會贏 → 🙋 自己當演算法 → 🎛 調參過關。建議照這個順序玩，卡片上會記錄你的最佳成績。', finishLabel: '開始挑戰' }],
  predict: [{ title: '🔮 預測誰會贏', html: '看地圖和 <b>🔑 線索</b>，猜<b>小龍還是狐狸</b>會找到更高的地方。山羊一起跑當對照組。一局 5 題，賽後告訴你為什麼。', finishLabel: '開始預測' }],
  'play-2d': [{ title: '🗺 2D 探險', html: '地圖被雲遮住。點<b>橘框格子</b>移動，看過的地方會留著。視野越大、步數越少。最後和三隻動物比高度。', finishLabel: '開始探險' }],
  'play-1d': [{ title: '🐲 我當小龍', html: '每輪決定<b>接受或拒絕</b>一個提案。看冒險尺：在「p=0.5」線左邊傾向接受、右邊傾向拒絕。', finishLabel: '開始' }],
  'play-tsp': [{ title: '🧭 TSP 改路線', html: '點路線上<b>兩條線</b>（最好是有紅圈、互相交叉的），看預覽後按「確定」。15 次內把路線改到最短。', finishLabel: '開始改路線' }],
  tune: [{ title: '🎛 調參過關', html: '同一組參數會從 <b>5 個起點</b>各跑一次，成功 3 次就過關。卡關就打開「💡 提示」（看答案最多 ★）。', finishLabel: '開始調參' }],
});

const modeGuideKey = (id) => `mode-${id}`;

function openModeGuide(id) {
  getGuideModal().open(MODE_GUIDES[id], modeGuideKey(id));
}

function openModeGuideIfFirstTime(id) {
  return getGuideModal().openIfFirstTime(MODE_GUIDES[id], modeGuideKey(id));
}

/** "❓ 怎麼玩" button that replays a mode's guide. */
function modeGuideButton(id, label = '❓ 怎麼玩') {
  return h('button', { type: 'button', class: 'btn btn-small guide-btn', onClick: () => openModeGuide(id) }, label);
}
