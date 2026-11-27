const API_ENDPOINT =
  "https://api.data.go.kr/openapi/tn_pubr_public_traffic_light_api";

export default async function handler({ request }) {
  const apiKey = Netlify.env.get("TRAFFIC_API_KEY");

  if (!apiKey) {
    return Response.json(
      { error: "TRAFFIC_API_KEY 환경변수가 없습니다." },
      { status: 500 }
    );
  }

  try {
    const incoming = new URL(request.url);
    const params = new URLSearchParams();

    params.set("serviceKey", apiKey);
    params.set("pageNo", incoming.searchParams.get("pageNo") || "1");
    params.set("numOfRows", incoming.searchParams.get("numOfRows") || "5");
    params.set("type", "json");

    const filters = [
      "ctprvnNm",
      "signguNm",
      "roadKnd",
      "roadRouteNo",
      "roadRouteNm",
      "roadRouteDrc",
      "rdnmadr",
      "lnmadr",
      "tfclghtManageNo",
      "tfclghtSe",
      "tfclghtColorKnd",
      "sgnaspMthd",
      "sgnaspOrdr",
      "sgnaspTime",
      "sotKnd",
      "signlCtrlMthd",
      "signlTimeMthdType",
      "opratnYn",
      "fnctngSgngnrYn",
      "remndrIdctYn",
      "sondSgngnrYn"
    ];

    for (const key of filters) {
      const value = incoming.searchParams.get(key);
      if (value) params.set(key, value);
    }

    const upstream = await fetch(
      `${API_ENDPOINT}?${params.toString()}`
    );

    const raw = await upstream.text();

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      return Response.json(
        {
          error: "공공데이터 API가 JSON이 아닌 응답을 반환했습니다.",
          upstreamStatus: upstream.status,
          contentType: upstream.headers.get("content-type"),
          preview: raw.slice(0, 1000)
        },
        { status: 502 }
      );
    }

    return Response.json(data, {
      status: upstream.ok ? 200 : upstream.status
    });
  } catch (error) {
    return Response.json(
      {
        error: "API 호출 중 오류 발생",
        message: error.message
      },
      { status: 500 }
    );
  }
}
