import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    const privateKey =
      process.env.IMAGEKIT_PRIVATE_KEY ||
      "private_WO7Ad0iA82l0GPTyWu/ABqSGYHo=";

    // Convert file to base64 buffer for ImageKit upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64File = buffer.toString("base64");

    const uploadPayload = new FormData();
    uploadPayload.append("file", base64File);
    uploadPayload.append(
      "fileName",
      file.name ? file.name.replace(/[^a-zA-Z0-9._-]/g, "_") : `vehicle_${Date.now()}.jpg`
    );
    uploadPayload.append("folder", "/vehicles");
    uploadPayload.append("useUniqueFileName", "true");

    const authHeader = `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`;

    const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      headers: {
        Authorization: authHeader,
      },
      body: uploadPayload,
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("ImageKit upload error:", data);
      return NextResponse.json(
        {
          success: false,
          error: data.message || "Failed to upload image to ImageKit",
        },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      url: data.url,
      thumbnailUrl: data.thumbnailUrl || data.url,
      fileId: data.fileId,
      name: data.name,
    });
  } catch (err: unknown) {
    console.error("Upload route exception:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
