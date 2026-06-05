const crypto = require('crypto');
const { DEFAULT_CURRICULUM, CURRICULUM_LEVELS } = require('./config');

const nowIso = () => new Date().toISOString();
const addMilliseconds = (ms) => new Date(Date.now() + ms).toISOString();
const generateRandomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
const hashToken = (value) => crypto.createHash('sha256').update(value).digest('hex');

const getCurriculumLevels = (curriculum) => {
  if (typeof curriculum !== 'string' || !CURRICULUM_LEVELS[curriculum]) {
    return CURRICULUM_LEVELS[DEFAULT_CURRICULUM];
  }
  return CURRICULUM_LEVELS[curriculum];
};

const getNextGrade = (curriculum, currentGrade) => {
  const levels = getCurriculumLevels(curriculum);
  if (!currentGrade) {
    return { nextGrade: null, status: 'Promoted' };
  }
  const index = levels.indexOf(currentGrade);
  if (index === -1) {
    return { nextGrade: null, status: 'Promoted' };
  }
  if (index === levels.length - 1) {
    return { nextGrade: null, status: 'Graduated' };
  }
  return { nextGrade: levels[index + 1], status: 'Promoted' };
};

const getMonthName = (monthStr) => {
  const [, month] = monthStr.split('-');
  const date = new Date();
  date.setMonth(parseInt(month, 10) - 1);
  return date.toLocaleString('default', { month: 'long' });
};

module.exports = {
  nowIso,
  addMilliseconds,
  generateRandomToken,
  hashToken,
  getCurriculumLevels,
  getNextGrade,
  getMonthName
};