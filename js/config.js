// 固定設定：存檔名稱、欄數、關卡模式、泡泡顏色、音樂旋律
const BEST_KEY = 'bubbleGarden.best';

let columns = 10;
const initialRows = 6;
const maxLevels = 50;
const modeSettings = {
  classic: { label: '經典花園・無限制' },
  campaign: { label: '闖關模式' },
  falling: { label: '下降闖關', interval: 8 },
  timed: { label: '限時挑戰', seconds: 60 },
  shots: { label: '限球挑戰', shots: 25 },
  descent: { label: '下降挑戰', interval: 8 },
};
const maxDropsPerLevel = 8;
const colors = [
  { fill: '#f05a9d', light: '#ffd3e6' },
  { fill: '#84c4f1', light: '#e1f4ff' },
  { fill: '#f17a54', light: '#ffd3b5' },
  { fill: '#f2bd4d', light: '#fff0b5' },
  { fill: '#83d6a1', light: '#e0ffe7' },
  { fill: '#8b5cf6', light: '#e5d8ff' },
];
const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46, 523.25, 587.33, 698.46, 783.99, 880, 783.99, 698.46, 587.33];
