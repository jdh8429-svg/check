exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  try {
    const { text } = JSON.parse(event.body);
    if (!text) return { statusCode: 400, headers, body: JSON.stringify({ error: 'text is required' }) };

    // 1단계: 네이버 검색 페이지에서 passportKey 실시간 추출
    const searchRes = await fetch(
      'https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=네이버+맞춤법+검사기',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9',
        }
      }
    );

    const html = await searchRes.text();
    const match = html.match(/passportKey=([^&"'}\s<>]+)/);
    if (!match) throw new Error('passportKey 추출 실패');
    const passportKey = match[1];

    // 2단계: 500자씩 나눠서 병렬 요청
    const chunks = splitText(text, 500);
    const results = await Promise.all(chunks.map(chunk => checkChunk(chunk, passportKey)));

    // 3단계: 결과 합치기
    const corrected = results.map(r => r.corrected).join('');
    const changes = results.flatMap(r => r.changes);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ corrected, changes, original: text }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

// 500자 단위로 줄바꿈 기준 분리
function splitText(text, limit) {
  const lines = text.split('\n');
  const chunks = [];
  let current = '';

  for (const line of lines) {
    if ((current + '\n' + line).trim().length > limit) {
      if (current.trim()) chunks.push(current.trim());
      current = line;
    } else {
      current = current ? current + '\n' + line : line;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text.substring(0, 500)];
}

async function checkChunk(text, passportKey) {
  const url = `https://m.search.naver.com/p/csearch/ocontent/util/SpellerProxy?passportKey=${passportKey}&_callback=_cb&q=${encodeURIComponent(text)}&where=nexearch&color_blindness=0&_=${Date.now()}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Referer': 'https://search.naver.com/',
      'Accept-Language': 'ko-KR,ko;q=0.9',
    }
  });

  const raw = await res.text();
  const jsonMatch = raw.match(/_cb\s*\(\s*(\{[\s\S]*?\})\s*\)/);
  if (!jsonMatch) throw new Error('응답 파싱 실패: ' + raw.substring(0, 100));

  const data = JSON.parse(jsonMatch[1]);
  if (data.message?.error) throw new Error('네이버 오류: ' + data.message.error);

  const result = data.message?.result;
  if (!result) throw new Error('결과 없음');

  const corrected = result.notag || text;
  const changes = [];

  // 원문과 교정문 비교로 변경사항 추출
  if (corrected !== text && result.html) {
    // HTML에서 오류 단어 추출
    const errPattern = /<em[^>]+>(.*?)<\/em>/gi;
    let m;
    const seen = new Set();
    while ((m = errPattern.exec(result.html)) !== null) {
      const word = m[1].replace(/<[^>]+>/g, '').trim();
      if (word && !seen.has(word)) {
        seen.add(word);
      }
    }

    // 단어별 비교
    const origWords = text.replace(/\n/g, ' ').split(/\s+/);
    const corrWords = corrected.replace(/\n/g, ' ').split(/\s+/);
    const len = Math.min(origWords.length, corrWords.length);
    for (let i = 0; i < len; i++) {
      const o = origWords[i].replace(/[.,!?]/g, '');
      const c = corrWords[i].replace(/[.,!?]/g, '');
      if (o && c && o !== c) {
        changes.push({
          type: 'spell',
          before: origWords[i],
          after: corrWords[i],
          reason: '맞춤법·띄어쓰기 오류 (네이버 맞춤법 검사기)',
        });
      }
    }
  }

  return { corrected, changes };
}
