exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { text } = JSON.parse(event.body);
    if (!text) return { statusCode: 400, headers, body: JSON.stringify({ error: 'text is required' }) };

    // 1단계: 네이버 검색 페이지에서 passportKey 발급
    const searchRes = await fetch(
      'https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=1&ie=utf8&query=%EB%A7%9E%EC%B6%A4%EB%B2%95+%EA%B2%80%EC%82%AC%EA%B8%B0',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
          'Referer': 'https://www.naver.com/',
        },
      }
    );

    const html = await searchRes.text();

    // passportKey 추출
    const passportMatch = html.match(/passportKey=([^&"'\s<>]+)/);
    if (!passportMatch) {
      throw new Error('passportKey를 가져올 수 없습니다. 네이버 정책이 변경되었을 수 있습니다.');
    }
    const passportKey = passportMatch[1];

    // 2단계: 맞춤법 검사 요청
    const spellUrl = `https://m.search.naver.com/p/csearch/ocontent/util/SpellerProxy?passportKey=${passportKey}&_callback=mycallback&q=${encodeURIComponent(text)}&where=nexearch&color_blindness=0&_=${Date.now()}`;

    const spellRes = await fetch(spellUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer': 'https://search.naver.com/',
      },
    });

    const raw = await spellRes.text();

    // JSONP 파싱: mycallback({...})
    const jsonMatch = raw.match(/mycallback\s*\(\s*(\{[\s\S]*\})\s*\)/);
    if (!jsonMatch) {
      throw new Error('응답 파싱 실패');
    }

    const data = JSON.parse(jsonMatch[1]);

    if (data.message && data.message.error) {
      throw new Error('네이버 오류: ' + data.message.error);
    }

    const result = data.message && data.message.result;
    if (!result) {
      throw new Error('결과 없음');
    }

    // notag: 교정된 순수 텍스트
    const corrected = result.notag || text;
    const errataCount = result.errata_count || 0;

    // 변경사항 파싱 (HTML에서 오류/교정 단어 추출)
    const changes = [];
    if (result.html) {
      // 오류 단어는 <span class='em_color ...'>원래단어</span> 형태
      const errPattern = /<span[^>]+class=['"]([^'"]*em_color[^'"]*|[^'"]*err[^'"]*)['"]\s*[^>]*>(.*?)<\/span>/gi;
      let m;
      while ((m = errPattern.exec(result.html)) !== null) {
        const word = m[2].replace(/<[^>]+>/g, '').trim();
        if (word) {
          changes.push({ before: word, type: 'spell' });
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        corrected,
        original: text,
        errata_count: errataCount,
        changes,
      }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
