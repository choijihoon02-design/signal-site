
const BASE = "https://apis.data.go.kr/B551982/rti/";

const ENDPOINTS = new Set([
  "crsrd_map_info",
  "tl_drct_info"
]);

// ========================================
// JSON 응답
// ========================================

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });

// ========================================
// 숫자 범위 제한
// ========================================

const clamp = (value, min, max, defaultValue) => {
  const n = parseInt(value, 10);

  return Number.isFinite(n)
    ? Math.min(max, Math.max(min, n))
    : defaultValue;
};

// ========================================
// 메인 함수
// ========================================

export default async (req) => {

  // --------------------------------------
  // 1. API 인증키
  // --------------------------------------

  const key = process.env.RTI_KEY;

  if (!key) {
    return json({
      error: "RTI_KEY 환경 변수가 설정되지 않았어요."
    }, 500);
  }

  // --------------------------------------
  // 2. 동일 사이트 요청 확인
  // --------------------------------------

  const site = req.headers.get("sec-fetch-site");

  if (
    site &&
    site !== "same-origin" &&
    site !== "none"
  ) {
    return json({
      error: "허용되지 않은 요청이에요."
    }, 403);
  }

  // --------------------------------------
  // 3. 요청 매개변수
  // --------------------------------------

  const u = new URL(req.url);

  const ep = u.searchParams.get("ep");

  if (!ENDPOINTS.has(ep)) {
    return json({
      error: "ep는 crsrd_map_info 또는 tl_drct_info 여야 해요."
    }, 400);
  }

  // --------------------------------------
  // 4. 법정동 코드
  // --------------------------------------
  // 기존 코드:
  // 코드가 없으면 HTTP 400
  //
  // 수정:
  // 코드가 없어도 API 호출 허용

  const rawStdgCd = u.searchParams.get("stdgCd");

  let stdgCd = "";

  if (rawStdgCd !== null && rawStdgCd !== "") {

    if (!/^\d{10}$/.test(rawStdgCd)) {
      return json({
        error: "stdgCd는 10자리 숫자여야 해요."
      }, 400);
    }

    stdgCd = rawStdgCd;

  }

  // --------------------------------------
  // 5. 페이지 설정
  // --------------------------------------

  const pageNo = clamp(
    u.searchParams.get("pageNo"),
    1,
    100000,
    1
  );

  const numOfRows = clamp(
    u.searchParams.get("numOfRows"),
    1,
    1000,
    10
  );

  // --------------------------------------
  // 6. 인증키 인코딩
  // --------------------------------------

  // Encoding 키(% 포함)는 그대로 사용
  // Decoding 키는 URL 인코딩

  const serviceKey = key.includes("%")
    ? key
    : encodeURIComponent(key);

  // --------------------------------------
  // 7. 공공데이터포털 URL 구성
  // --------------------------------------

  let url =
    `${BASE}${ep}` +
    `?serviceKey=${serviceKey}` +
    `&pageNo=${pageNo}` +
    `&numOfRows=${numOfRows}` +
    `&type=JSON`;

  // 법정동 코드가 있을 때만 추가

  if (stdgCd) {
    url += `&stdgCd=${stdgCd}`;
  }

  // --------------------------------------
  // 8. API 호출
  // --------------------------------------

  try {

    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(15000),
      headers: {
        "Accept": "application/json"
      }
    });

    // ------------------------------------
    // 9. 원본 응답 읽기
    // ------------------------------------

    const responseText = await response.text();

    // ------------------------------------
    // 10. HTTP 오류 처리
    // ------------------------------------

    if (!response.ok) {
      return json({
        error: "공공데이터포털 HTTP 오류",
        upstreamStatus: response.status,
        endpoint: ep,
        stdgCd: stdgCd || null,
        pageNo,
        numOfRows,
        response: responseText.slice(0, 2000)
      }, 502);
    }

    // ------------------------------------
    // 11. 응답 JSON 검사
    // ------------------------------------

    let data;

    try {

      data = JSON.parse(responseText);

    } catch {

      return json({
        error: "공공데이터포털에서 JSON이 아닌 응답을 반환했어요.",
        endpoint: ep,
        response: responseText.slice(0, 2000)
      }, 502);

    }

    // ------------------------------------
    // 12. 최종 응답
    // ------------------------------------

    return new Response(
      JSON.stringify(data),
      {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",

          // 교차로 위치는 24시간 캐시
          // 신호 잔여시간은 3초 캐시
          "cache-control":
            ep === "crsrd_map_info"
              ? "public, max-age=86400"
              : "public, max-age=3"
        }
      }
    );

  } catch (error) {

    // ------------------------------------
    // 13. 네트워크 오류 및 시간 초과
    // ------------------------------------

    const isTimeout =
      error.name === "TimeoutError" ||
      error.name === "AbortError";

    return json({
      error: isTimeout
        ? "공공데이터포털 응답 시간이 초과되었어요."
        : "공공데이터포털 호출에 실패했어요.",

      detail: error.message || "Unknown error",

      endpoint: ep,
      stdgCd: stdgCd || null
    }, 502);

  }

};

// ========================================
// Netlify 라우팅
// ========================================

export const config = {
  path: "/api/rti"
};
