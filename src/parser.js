'use strict';

const crypto = require('node:crypto');
const { load } = require('cheerio');

const MONTHS = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const COUNTRY_NAMES = {
  AT: 'Austria',
  BE: 'Belgium',
  BG: 'Bulgaria',
  CY: 'Cyprus',
  CZ: 'Czechia',
  DE: 'Germany',
  DK: 'Denmark',
  EE: 'Estonia',
  ES: 'Spain',
  FI: 'Finland',
  FR: 'France',
  GR: 'Greece',
  HR: 'Croatia',
  HU: 'Hungary',
  IE: 'Ireland',
  IT: 'Italy',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  LV: 'Latvia',
  MT: 'Malta',
  NL: 'Netherlands',
  PL: 'Poland',
  PT: 'Portugal',
  RO: 'Romania',
  SE: 'Sweden',
  SI: 'Slovenia',
  SK: 'Slovakia',
};

const COUNTRY_ALIASES = {
  austria: 'AT',
  belgium: 'BE',
  bulgaria: 'BG',
  croatia: 'HR',
  cyprus: 'CY',
  czechia: 'CZ',
  'czech republic': 'CZ',
  denmark: 'DK',
  estonia: 'EE',
  finland: 'FI',
  france: 'FR',
  germany: 'DE',
  greece: 'GR',
  hungary: 'HU',
  ireland: 'IE',
  italy: 'IT',
  latvia: 'LV',
  lithuania: 'LT',
  luxembourg: 'LU',
  malta: 'MT',
  netherlands: 'NL',
  'the netherlands': 'NL',
  poland: 'PL',
  portugal: 'PT',
  romania: 'RO',
  slovakia: 'SK',
  slovenia: 'SI',
  spain: 'ES',
  sweden: 'SE',
};

const CITY_COUNTRY = {
  alicante: 'ES',
  amsterdam: 'NL',
  athens: 'GR',
  barcelona: 'ES',
  berlin: 'DE',
  bilbao: 'ES',
  bonn: 'DE',
  bratislava: 'SK',
  brussels: 'BE',
  bucharest: 'RO',
  budapest: 'HU',
  copenhagen: 'DK',
  dublin: 'IE',
  florence: 'IT',
  frankfurt: 'DE',
  'frankfurt am main': 'DE',
  helsinki: 'FI',
  lisbon: 'PT',
  ljubljana: 'SI',
  london: 'GB',
  luxembourg: 'LU',
  madrid: 'ES',
  milan: 'IT',
  munich: 'DE',
  nicosia: 'CY',
  paris: 'FR',
  prague: 'CZ',
  riga: 'LV',
  rome: 'IT',
  sofia: 'BG',
  stockholm: 'SE',
  tallinn: 'EE',
  'the hague': 'NL',
  valletta: 'MT',
  vienna: 'AT',
  vilnius: 'LT',
  warsaw: 'PL',
  zagreb: 'HR',
};

const AGENCY_ALIASES = {
  ACER: 'Agency for the Cooperation of Energy Regulators',
  AMLA: 'Anti-Money Laundering Authority',
  CEPOL: 'EU Agency for Law Enforcement Training',
  EASA: 'European Union Aviation Safety Agency',
  ECDC: 'European Centre for Disease Prevention and Control',
  ECHA: 'European Chemicals Agency',
  EC: 'European Commission',
  EDA: 'European Defence Agency',
  EEA: 'European Environment Agency',
  EIOPA: 'European Insurance and Occupational Pensions Authority',
  ELA: 'European Labour Authority',
  EMA: 'European Medicines Agency',
  ENISA: 'European Union Agency for Cybersecurity',
  ERA: 'European Union Railways Agency',
  ETF: 'European Training Foundation',
  EUAA: 'European Union Agency for Asylum',
  EUDA: 'European Union Drugs Agency',
  EUI: 'European University Institute',
  EUIPO: 'European Union Intellectual Property Office',
  'EU-LISA': 'European Union Agency for the Operational Management of Large-Scale IT Systems',
  'EU-OSHA': 'European Agency for Safety and Health at Work',
  EUROFOUND: 'Eurofound',
  EUROPOL: 'European Union Agency for Law Enforcement Cooperation',
  EUSPA: 'European Union Agency for the Space Programme',
  F4E: 'Fusion for Energy',
  FRONTEX: 'European Border and Coast Guard Agency',
  GSC: 'General Secretariat of the Council of the European Union',
  'IHI JU': 'Innovative Health Initiative Joint Undertaking',
  'SESAR 3 JU': 'SESAR 3 Joint Undertaking',
};

const ACRONYMS = new Set([
  'AD', 'AI', 'AST', 'CA', 'CEPOL', 'EC', 'ECB', 'ECDC', 'ECHA', 'EEA', 'EFTA',
  'EPSO', 'EU', 'EUAA', 'EUI', 'EUIPO', 'EUR', 'FG', 'F4E', 'HR', 'IT', 'JU',
  'SC', 'SME', 'UK', 'UN', 'US', 'RTI', 'SESAR', 'ECDC',
]);

const SMALL_WORDS = new Set(['and', 'at', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

const EMOJI_ONLY = /^[\p{Regional_Indicator}\p{Extended_Pictographic}\uFE0F\u200D\s]+/u;
const REGIONAL_FLAG = /\p{Regional_Indicator}{2}/u;

function cleanText(value = '') {
  return String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLeadingEmoji(value = '') {
  return cleanText(value.replace(EMOJI_ONLY, ''));
}

function flagToCode(flag) {
  if (!flag) return null;
  const points = [...flag].map((char) => char.codePointAt(0));
  if (points.length !== 2) return null;
  const letters = points.map((point) => String.fromCharCode(point - 0x1f1e6 + 65));
  if (!letters.every((letter) => /^[A-Z]$/.test(letter))) return null;
  return letters.join('');
}

function codeToFlag(code) {
  if (!code || !/^[A-Z]{2}$/.test(code)) return null;
  return String.fromCodePoint(...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
}

function uppercaseRatio(value) {
  const letters = value.replace(/[^\p{L}]/gu, '');
  if (!letters) return 0;
  const upper = letters.replace(/[^\p{Lu}]/gu, '').length;
  return upper / letters.length;
}

function smartTitle(value) {
  const text = cleanText(value);
  if (uppercaseRatio(text) < 0.72) return text;
  return text
    .toLowerCase()
    .split(/([\s\-–—/&,.()]+)/)
    .map((part, index) => {
      if (!/^\p{L}/u.test(part)) return part;
      const upper = part.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      if (index > 0 && SMALL_WORDS.has(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}

function cleanTitle(raw) {
  let title = stripLeadingEmoji(raw)
    .replace(/\s*\|\s*/g, ' | ')
    .trim();
  title = title
    .replace(/\s*\((?:[^)]*?\b(?:Contract Agent|Temporary Agent|Administrator|Assistant|FG\s*(?:II|III|IV)|AST(?:\/SC)?\s*\d+|AD\s*\d)[^)]*)\)\s*$/i, '')
    .replace(/\s*[-–—]\s*$/, '')
    .trim();
  return smartTitle(title);
}

function titleCaseWords(value) {
  return smartTitle(value);
}

function parseTitleParts(raw) {
  const text = stripLeadingEmoji(raw);
  const parts = text.split('|').map((part) => cleanText(part)).filter(Boolean);
  if (parts.length < 2) {
    return { role: cleanTitle(text), typeText: '', agencyText: '' };
  }
  const role = cleanTitle(parts[0]);
  const tail = parts.slice(1);
  const contractIndex = tail.findIndex((part) =>
    /contract agent|temporary agent|assistant|administrator|FG\s*(?:II|III|IV)|AST(?:\/SC)?\s*\d+|AD\s*\d/i.test(part),
  );
  let agencyText = '';
  let typeText = '';
  if (tail.length === 1) {
    if (contractIndex === 0) typeText = tail[0];
    else agencyText = tail[0];
  } else if (contractIndex >= 0) {
    typeText = tail[contractIndex];
    agencyText = tail[tail.length - 1] === typeText ? tail.slice(0, -1).join(' ') : tail[tail.length - 1];
  } else {
    typeText = tail[0];
    agencyText = tail[tail.length - 1];
  }
  return { role, typeText, agencyText };
}

function fieldLine(text, label) {
  const match = text.match(new RegExp(`(?:^|\\n)[^\\n]*?${label}\\s*:\\s*([^|\\n]+)`, 'i'));
  return match ? cleanText(match[1]) : '';
}

function extractAgencyFromText(text) {
  return fieldLine(text, 'Agency');
}

function extractLocationText(text) {
  return fieldLine(text, '(?:Location|Place of employment)');
}

function extractDeadlineText(text) {
  return fieldLine(text, 'Deadline');
}

function extractIndefinite(text) {
  const match = text.match(/Indefinite Contract Possibility\s*:\s*(✅|✔�??|Yes|⛔|�?�|No)/i);
  if (!match) return null;
  return !/no|⛔|�?�/i.test(match[1]);
}

function parseDeadline(raw, postDate) {
  if (!raw) return { date: null, text: '' };
  const text = cleanText(raw).replace(/^[�?�📅\s:–—-]+/u, '');
  if (!text || /open until filled|rolling|asap|ongoing|not specified/i.test(text)) {
    return { date: null, text: text || '' };
  }

  let day;
  let month;
  let year;
  const monthPattern = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
  const named = text.match(new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})\\b(?:\\s+(\\d{4}))?`, 'i'));
  if (named) {
    day = Number(named[1]);
    month = MONTHS[named[2].toLowerCase()];
    year = named[3] ? Number(named[3]) : null;
  } else {
    const numeric = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
    if (numeric) {
      day = Number(numeric[1]);
      month = Number(numeric[2]);
      year = Number(numeric[3]);
      if (year < 100) year += 2000;
    }
  }
  if (!day || !month || day > 31 || month > 12) {
    return { date: null, text };
  }

  const base = postDate instanceof Date && !Number.isNaN(postDate.valueOf()) ? postDate : new Date();
  if (!year) {
    year = base.getUTCFullYear();
    const candidate = Date.UTC(year, month - 1, day);
    if (candidate < base.getTime() - 21 * 24 * 60 * 60 * 1000) year += 1;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { date: null, text };
  }
  return { date: date.toISOString().slice(0, 10), text };
}

function parseMoneyAmounts(text) {
  const amounts = [];
  const matches = text.matchAll(/(?:€|EUR)\s*([\d][\d.,\s]*)/gi);
  for (const match of matches) {
    const cleaned = match[1].replace(/[.,\s]+$/g, '').trim();
    if (!cleaned) continue;
    let digitString;
    if (/^\d{1,3}(?:[.,]\d{3})+$/.test(cleaned)) {
      digitString = cleaned.replace(/[.,]/g, '');
    } else if (/^\d+$/.test(cleaned)) {
      digitString = cleaned;
    } else {
      const first = cleaned.match(/^\d{1,3}(?:[.,]\d{3})+/);
      digitString = first ? first[0].replace(/[.,]/g, '') : cleaned.replace(/[^\d]/g, '');
    }
    const amount = Number(digitString);
    if (Number.isFinite(amount) && amount >= 500 && amount <= 30000) amounts.push(amount);
  }
  return amounts;
}

function formatMoney(amount) {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(amount);
}

function formatSalary(amounts) {
  if (!amounts.length) return { summary: 'Salary not listed', min: null, max: null };
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const summary = min === max
    ? `€${formatMoney(min)} / month`
    : `€${formatMoney(min)}–€${formatMoney(max)} / month`;
  return { summary, min, max };
}

function inferCountry(location, flagCode) {
  if (flagCode) return flagCode;
  const lower = cleanText(location).toLowerCase();
  for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
    if (lower.includes(alias)) return code;
  }
  for (const [city, code] of Object.entries(CITY_COUNTRY)) {
    if (lower.includes(city)) return code;
  }
  return null;
}

function titleCasePlace(value) {
  const text = cleanText(value).replace(/[.,;]+$/, '');
  return text
    .split(/([\s-]+)/)
    .map((part, index) => {
      if (!/^\p{L}/u.test(part)) return part;
      if (index > 0 && SMALL_WORDS.has(part.toLowerCase())) return part.toLowerCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
}

const CITY_ALIASES = {
  'frankfurt am main': 'Frankfurt',
  'frankfurt': 'Frankfurt',
  'the hague': 'The Hague',
};

function normalizeCity(value) {
  const text = cleanText(value).replace(/[.,;]+$/, '');
  if (!text) return '';
  const alias = CITY_ALIASES[text.toLowerCase()];
  if (alias) return alias;
  return titleCasePlace(text);
}

function parseLocation(location, flagCode) {
  const text = cleanText(location).replace(/\s*\|\s*.*$/, '');
  let code = inferCountry(text, flagCode);
  let city = '';
  let country = code ? COUNTRY_NAMES[code] || code : '';

  if (text.includes(',')) {
    const [first, ...rest] = text.split(',');
    city = normalizeCity(first);
    const countryPart = cleanText(rest.join(','));
    const found = inferCountry(countryPart, null);
    if (found) {
      code = found;
      country = COUNTRY_NAMES[found] || titleCasePlace(countryPart);
    }
  } else {
    const knownCity = Object.entries(CITY_COUNTRY)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([cityName]) => text.toLowerCase().includes(cityName));
    if (knownCity) {
      city = normalizeCity(knownCity[0]);
      if (!code) code = knownCity[1];
    } else if (code) {
      const countryLower = (COUNTRY_NAMES[code] || '').toLowerCase();
      city = text.toLowerCase() === countryLower ? '' : normalizeCity(text.replace(new RegExp(countryLower, 'i'), ''));
    } else {
      city = normalizeCity(text);
    }
  }

  if (code) country = COUNTRY_NAMES[code] || country;
  if (city && code) {
    const cityCode = CITY_COUNTRY[city.toLowerCase()];
    if (cityCode && cityCode !== code) {
      country = COUNTRY_NAMES[cityCode] || country;
      code = cityCode;
    }
  }
  return { city, country, code };
}

function parseContract(title, typeText, fullText) {
  const source = `${title} ${typeText} ${fullText.slice(0, 900)}`.replace(/\s+/g, ' ').trim();
  let contractType = 'EU contract';
  let grade = '';
  let category = 'Other';

  const contractAgent = source.match(/contract agent(?:\s*[,/–—-]?\s*(FG\s*(?:IV|III|II))\b)?/i);
  if (contractAgent) {
    contractType = 'Contract Agent';
    grade = contractAgent[1] || (source.match(/\bFG\s*(?:IV|III|II)\b/i)?.[0] || '');
    category = 'Contract Agents';
  }

  const temporary = source.match(/temporary agent(?:\s*[,/–—-]?\s*(AST(?:\/SC)?\s*\d+|AD\s*\d+(?:\s*[-–—]\s*AD?\s*\d+)?))?/i);
  if (temporary && !contractAgent) {
    contractType = 'Temporary Agent';
    grade = temporary[1] || '';
  }

  const assistant = source.match(/\bassistant\b[^|]{0,45}?\b(AST(?:\/SC)?\s*\d+(?:\s*[-–—]\s*\d+)?)/i)
    || source.match(/\b(AST(?:\/SC)?\s*\d+(?:\s*[-–—]\s*\d+)?)/i);
  if (assistant) {
    grade = grade || assistant[1];
    if (!contractAgent && !temporary) contractType = 'Assistant';
    if (category === 'Other') category = 'Assistants';
  }

  const admin = source.match(/\bAdministrator\b[^|]{0,35}?\b(AD\s*\d+(?:\s*[-–—]\s*AD?\s*\d+)?)/i)
    || source.match(/\b(AD\s*\d+(?:\s*[-–—]\s*AD?\s*\d+)?)/i);
  if (admin) {
    grade = grade || admin[1];
    if (!contractAgent) {
      if (!temporary) contractType = 'Administrator';
      category = 'Administrators';
    }
  }

  if (category === 'Other' && /\bFG\s*(?:IV|III|II)\b/i.test(source)) {
    category = 'Contract Agents';
    contractType = 'Contract Agent';
  }
  if (category === 'Other' && /\bAST(?:\/SC)?\b/i.test(source)) {
    category = 'Assistants';
    contractType = 'Assistant';
  }
  if (category === 'Other' && /\bAD\s*\d/i.test(source)) {
    category = 'Administrators';
    contractType = 'Administrator';
  }

  grade = cleanText(grade)
    .replace(/\s*[-–—]\s*AD?\s*/gi, '–')
    .replace(/\s+/g, ' ')
    .toUpperCase();
  if (!grade) grade = '';

  return { contractType, grade, category };
}

function normalizeCategory(section) {
  const text = cleanText(section).toLowerCase();
  if (/assistant|ast/.test(text)) return 'Assistants';
  if (/administrator|ad\s*\d/.test(text)) return 'Administrators';
  if (/contract agent|fg/.test(text)) return 'Contract Agents';
  return null;
}

function cleanAgency(raw) {
  let agency = stripLeadingEmoji(cleanText(raw)).replace(/^Agency\s*:\s*/i, '');
  agency = agency.replace(/\s*\([A-Z][A-Z0-9-]{1,9}\)/g, '');
  agency = agency.replace(/\s*\([^)]*\)\s*$/, '');
  agency = agency.replace(/\s*\/\s*Euratom\s*$/i, ' / Euratom');
  return titleCaseWords(cleanText(agency));
}

function agencyShort(raw, explicitShort) {
  if (explicitShort) return explicitShort.toUpperCase();
  const text = cleanText(raw);
  const leading = text.match(/^([A-Z][A-Z0-9-]{1,9})\b/);
  if (leading && AGENCY_ALIASES[leading[1]]) return leading[1];
  const parentheses = text.match(/\(([A-Z][A-Z0-9-]{1,9})\)/);
  if (parentheses) return parentheses[1];
  if (/^[A-Z0-9-]{2,10}$/.test(text)) return text;
  const lookup = Object.entries(AGENCY_ALIASES).find(([, name]) => name.toLowerCase() === text.toLowerCase());
  return lookup ? lookup[0] : '';
}

function resolveAgency(raw, short) {
  let name = cleanAgency(raw);
  const acronym = agencyShort(raw, short);
  if (acronym && AGENCY_ALIASES[acronym]) name = AGENCY_ALIASES[acronym];
  if (!name) name = 'EU institution';
  return { name, short: acronym || name.split(/\s+/).map((word) => word[0]).join('').slice(0, 5).toUpperCase() };
}

function chooseApplyUrl($, $segment, sourceUrl, fullText = '') {
  const candidates = [];
  $segment.find('a[href]').each((_, anchor) => {
    const href = ($(anchor).attr('href') || '').trim();
    if (!/^https?:\/\//i.test(href)) return;
    let host;
    try {
      host = new URL(href).hostname.toLowerCase();
    } catch {
      return;
    }
    if (/euemployment\.eu$|facebook\.com$|instagram\.com$|gemini\.google\.com$|google\.com$|linkedin\.com$|twitter\.com$|x\.com$/.test(host)) return;
    const text = cleanText($(anchor).text());
    let score = 0;
    if (/apply|application|view details|view vacancy|vacancy/i.test(text)) score += 10;
    if (/careers|vacanc|jobs|job|recruit/i.test(href)) score += 3;
    if (/\.(png|jpe?g|webp|svg|gif)$/i.test(href)) return;
    candidates.push({ href, score, text });
  });
  candidates.sort((a, b) => b.score - a.score);
  if (candidates.length) return candidates[0].href;
  const bare = fullText.match(/(?:Apply|Application)\s*:\s*(https?:\/\/[^\s<]+)/i);
  if (bare) return bare[1].replace(/[),.;]+$/, '');
  return sourceUrl || '';
}

function fingerprintFor(job) {
  const normalizedCity = CITY_ALIASES[cleanText(job.locationCity).toLowerCase()] || job.locationCity;
  const base = [job.title, job.agency, normalizedCity, job.locationCountry, job.grade]
    .map((part) => cleanText(part).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim())
    .join('|');
  return crypto.createHash('sha256').update(base).digest('hex');
}

function contentHashFor(job) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      title: job.title,
      agency: job.agency,
      city: job.locationCity,
      country: job.locationCountry,
      grade: job.grade,
      contractType: job.contractType,
      category: job.category,
      deadline: job.deadlineDate,
      salary: job.salarySummary,
      apply: job.applyUrl,
    }))
    .digest('hex');
}

function buildJob(rawTitle, options) {
  const { $, segment, section, post, fallbackAgency = '' } = options;
  const { role, typeText, agencyText } = parseTitleParts(rawTitle);
  const fullText = segment
    .children()
    .toArray()
    .map((element) => {
      const clone = $(element).clone();
      clone.find('br').replaceWith('\n');
      return clone.text().split('\n').map((line) => cleanText(line)).filter(Boolean).join('\n');
    })
    .filter(Boolean)
    .join('\n');
  const flagMatch = `${rawTitle} ${fullText.slice(0, 120)}`.match(REGIONAL_FLAG);
  const flagCode = flagMatch ? flagToCode(flagMatch[0]) : null;
  const agencyRaw = extractAgencyFromText(fullText) || agencyText || fallbackAgency;
  const agency = resolveAgency(agencyRaw, agencyShort(agencyText || agencyRaw));
  const locationRaw = extractLocationText(fullText);
  const location = parseLocation(locationRaw, flagCode);
  const deadlineRaw = extractDeadlineText(fullText);
  const deadline = parseDeadline(deadlineRaw, new Date(post.date));
  const contract = parseContract(rawTitle, typeText, fullText);
  const sectionCategory = normalizeCategory(section);
  const category = sectionCategory || contract.category;
  const salary = formatSalary(parseMoneyAmounts(fullText));
  const applyUrl = chooseApplyUrl($, segment, post.link, fullText);
  const indefinite = extractIndefinite(fullText);
  let title = role;
  if (!title || title.length < 3) return null;
  if (title.length > 160) title = `${title.slice(0, 157)}…`;
  if (!deadline.date && !applyUrl && !agencyRaw) return null;

  const job = {
    title,
    agency: agency.name,
    agencyShort: agency.short,
    locationCity: location.city || location.country || 'Europe',
    locationCountry: location.country,
    countryCode: location.code,
    flag: codeToFlag(location.code),
    contractType: contract.contractType,
    grade: contract.grade,
    category,
    salarySummary: salary.summary,
    salaryMin: salary.min,
    salaryMax: salary.max,
    deadlineDate: deadline.date,
    deadlineText: deadline.text,
    indefiniteContract: indefinite,
    applyUrl,
    sourcePostId: post.id,
    sourcePostTitle: cleanText(post.title?.rendered || post.title || ''),
    sourcePostUrl: post.link,
    sourcePublishedAt: new Date(post.date).toISOString(),
  };
  job.fingerprint = fingerprintFor(job);
  job.contentHash = contentHashFor(job);
  return job;
}

function isTitleParagraph($element, section) {
  const text = cleanText($element.text());
  if (text.length < 8 || text.length > 220) return false;
  if (/^(deadline|agency|location|salary|apply|indefinite|👉|�?�|🙋|👨|view |quick navigation|background information|what |who |competitive)/i.test(text)) return false;
  const pipes = (text.match(/\|/g) || []).length;
  const strong = cleanText($element.find('strong').first().text());
  const hasContract = /contract agent|temporary agent|assistant|administrator|FG\s*(?:II|III|IV)|AST(?:\/SC)?\s*\d+|AD\s*\d/i.test(text);
  const flagged = REGIONAL_FLAG.test(text);
  if (pipes >= 2 && hasContract) return true;
  if (pipes >= 1 && hasContract && (strong.length > 5 || flagged)) return true;
  if (flagged && strong.length > 7 && hasContract && uppercaseRatio(text) > 0.45) return true;
  if (section && strong.length > 8 && hasContract && uppercaseRatio(text) > 0.6) return true;
  return false;
}

function parseSingleVacancy(post) {
  const $ = load(post.content?.rendered || '', null, false);
  const text = cleanText($.root().text());
  if (!/contract agent|temporary agent|assistant|administrator|vacanc/i.test(text)) return null;
  if (!/deadline/i.test(text)) return null;

  const title = cleanTitle(post.title?.rendered || post.title || 'EU vacancy');
  const flagMatch = text.match(REGIONAL_FLAG);
  const flagCode = flagMatch ? flagToCode(flagMatch[0]) : null;
  let agencyRaw = '';
  if (/council of the european union/i.test(text)) agencyRaw = 'Council of the European Union (GSC)';
  else {
    const agencyMatch = text.match(/(?:at|by|with)\s+(?:the\s+)?([A-Z][^.]{5,90}?(?:Agency|Authority|Commission|Institute|Office|Council|Foundation|Centre|Center|Undertaking))/);
    if (agencyMatch) agencyRaw = agencyMatch[1];
  }
  const city = Object.keys(CITY_COUNTRY).find((entry) => new RegExp(`\\b${entry}\\b`, 'i').test(text)) || '';
  const location = parseLocation(city, flagCode);
  const deadlineMatches = [...text.matchAll(/(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/gi)];
  const deadlineText = deadlineMatches.length ? deadlineMatches[deadlineMatches.length - 1][1] : '';
  const deadline = parseDeadline(deadlineText, new Date(post.date));
  const contract = parseContract(title, '', text);
  const salary = formatSalary(parseMoneyAmounts(text));
  const agency = resolveAgency(agencyRaw || 'EU institution', '');
  const applyUrl = chooseApplyUrl($, $.root(), post.link, text);
  const job = {
    title,
    agency: agency.name,
    agencyShort: agency.short,
    locationCity: location.city || location.country || 'Europe',
    locationCountry: location.country,
    countryCode: location.code,
    flag: codeToFlag(location.code),
    contractType: contract.contractType,
    grade: contract.grade,
    category: contract.category,
    salarySummary: salary.summary,
    salaryMin: salary.min,
    salaryMax: salary.max,
    deadlineDate: deadline.date,
    deadlineText: deadline.text,
    indefiniteContract: extractIndefinite(text),
    applyUrl,
    sourcePostId: post.id,
    sourcePostTitle: cleanText(post.title?.rendered || post.title || ''),
    sourcePostUrl: post.link,
    sourcePublishedAt: new Date(post.date).toISOString(),
  };
  job.fingerprint = fingerprintFor(job);
  job.contentHash = contentHashFor(job);
  return job;
}

function parsePost(post) {
  const html = post.content?.rendered || '';
  if (!html) return [];
  const $ = load(html, null, false);
  const blocks = $.root().children().toArray();

  const isSectionHeading = (text) => /^(contract agents?|assistants?|administrators?|temporary agents?)\b/i.test(text)
    && !text.includes('|');

  const h3Headings = $('h3').toArray().filter((element) => {
    const text = cleanText($(element).text());
    return text.length >= 4 && text.length <= 200
      && !isSectionHeading(text)
      && !/^(what|who|how|why|background|salary|benefits|application|selection)/i.test(text);
  });
  const headingMode = h3Headings.length >= 2;

  const segments = [];
  let section = '';
  let current = null;

  const flush = () => {
    if (current && current.elements.length) segments.push(current);
    current = null;
  };

  for (const element of blocks) {
    const tag = (element.tagName || '').toLowerCase();
    if (tag === 'h2') {
      flush();
      section = cleanText($(element).text());
      continue;
    }
    if (!['p', 'ul', 'ol', 'blockquote', 'figure', 'table', 'div', 'h3'].includes(tag)) continue;

    if (tag === 'h3') {
      const headingText = cleanText($(element).text());
      if (isSectionHeading(headingText)) {
        flush();
        section = headingText;
        continue;
      }
      if (headingMode) {
        flush();
        current = { title: headingText, section, elements: [element] };
      }
      continue;
    }

    if (!headingMode && (tag === 'p' || tag === 'div') && isTitleParagraph($(element), section)) {
      flush();
      current = { title: cleanText($(element).text()), section, elements: [element] };
      continue;
    }

    if (current) current.elements.push(element);
  }
  flush();

  const jobs = [];
  for (const segment of segments) {
    if (!segment.title) continue;
    const $segment = $('<div></div>');
    for (const element of segment.elements) $segment.append($(element).clone());
    const job = buildJob(segment.title, {
      $,
      segment: $segment,
      section: segment.section,
      post,
    });
    if (job) jobs.push(job);
  }

  if (!jobs.length) {
    const single = parseSingleVacancy(post);
    if (single) jobs.push(single);
  }

  return jobs;
}

module.exports = {
  parsePost,
  parseSingleVacancy,
  parseDeadline,
  parseContract,
  parseLocation,
  cleanText,
  smartTitle,
  fingerprintFor,
  contentHashFor,
  codeToFlag,
  flagToCode,
  extractDeadlineText,
  extractLocationText,
};

