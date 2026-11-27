const API_ENDPOINT =
  "https://api.data.go.kr/openapi/tn_pubr_public_traffic_light_api";

export const handler = async (event) => {
  // Netlify 환경변수에서 API 키 가져오기
  const apiKey = process.env.TRAFFIC_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        error: "TRAFFIC_API_KEY 환경변수가 없습니다."
      })
    };
  }

  try {
    const incoming = event.queryStringParameters || {};
    const params = new URLSearchParams();

    params.set("serviceKey", apiKey);
    params.set("pageNo", incoming.pageNo || "1");
    params.set("numOfRows", incoming.numOfRows || "5");
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
      if (incoming[key]) {
        params.set(key, incoming[key]);
      }
    }

    const upstream = await fetch(
      `${API_ENDPOINT}?${params.toString()}`
    );

    const raw = await upstream.text();

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      return {
        statusCode: 502,
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({
          error: "공공데이터 API가 JSON이 아닌 응답을 반환했습니다.",
          upstreamStatus: upstream.status,
          contentType: upstream.headers.get("content-type"),
          preview: raw.slice(0, 1000)
        })
      };
    }

    return {
      statusCode: upstream.ok ? 200 : upstream.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify(data)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        error: "API 호출 중 오류 발생",
        message: error.message
      })
    };
  }
};
