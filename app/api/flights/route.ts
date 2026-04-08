import { NextResponse } from "next/server";
import axios from "axios";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offset = searchParams.get("offset") || "0";
  const limit = searchParams.get("limit") || "100";

  const API_KEY = process.env.AVIATION_STACK_API_KEY;

  if (!API_KEY) {
    return NextResponse.json(
      { error: "AVIATION_STACK_API_KEY environment variable is not set." }, 
      { status: 401 }
    );
  }

  try {
    const res = await axios.get(`http://api.aviationstack.com/v1/flights`, {
      params: {
        access_key: API_KEY,
        limit,
        offset,
        flight_status: "active" // Defaulting to active flights for realtime mapping
      },
    });
    
    // We pass the payload directly from the AviationStack response
    return NextResponse.json(res.data);
  } catch (error: any) {
    console.error("AviationStack error:", error?.response?.data || error.message);
    return NextResponse.json(
      { error: "Failed to fetch from AviationStack via proxy." }, 
      { status: 500 }
    );
  }
}
