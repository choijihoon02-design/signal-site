// 공공데이터포털 "교통안전 신호등 실시간 정보" 중계 함수
// 인증키는 Netlify 환경 변수 RTI_KEY 에만 저장하고, 브라우저에는 노출하지 않는다.
const BASE = "https://apis.data.go.kr/B551982/rti/";
const ENDPOINTS = new Set(["crsrd_map_info", "tl_drct_info"]);

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const clamp = (v, min, max, dflt) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

export default async (req) => {
  const key = process.env.RTI_KEY;
  if (!key) return json({ error: "RTI_KEY 환경 변수가 설정되지 않았어요." }, 500);

  // 다른 사이트에서 브라우저로 끌어다 쓰는 것을 막는다(완벽한 방어는 아님).
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return json({ error: "허용되지 않은 요청이에요." }, 403);

  const u = new URL(req.url);
  const ep = u.searchParams.get("ep");
  if (!ENDPOINTS.has(ep)) return json({ error: "ep는 crsrd_map_info 또는 tl_drct_info 여야 해요." }, 400);

  const stdgCd = (u.searchParams.get("stdgCd") || "").replace(/\D/g, "");
  if (stdgCd.length !== 10) return json({ error: "stdgCd는 10자리 숫자여야 해요." }, 400);

  const pageNo = clamp(u.searchParams.get("pageNo"), 1, 100000, 1);
  const numOfRows = clamp(u.searchParams.get("numOfRows"), 1, 1000, 10);

  // 포털의 Encoding 키(%포함)면 그대로, Decoding 키면 인코딩해서 사용
  const k = key.includes("%") ? key : encodeURIComponent(key);
  const url = `${BASE}${ep}?serviceKey=${k}&pageNo=${pageNo}&numOfRows=${numOfRows}&type=JSON&stdgCd=${stdgCd}`;

  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const text = await r.text();
    return new Response(text, {
      status: r.ok ? 200 : 502,
      headers: {
        "content-type": r.headers.get("content-type") || "application/json; charset=utf-8",
        // 교차로 위치는 거의 안 바뀌므로 길게, 신호 잔여시간은 아주 짧게 캐시
        "cache-control": ep === "crsrd_map_info" ? "public, max-age=86400" : "public, max-age=3",
      },
    });
  } catch (e) {
    return json({ error: "공공데이터포털 호출에 실패했어요." }, 502);
  }
};

export const config = { path: "/api/rti" };
