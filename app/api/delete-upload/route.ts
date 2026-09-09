import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function POST(request: Request) {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Cloudinary credentials are not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { publicId, resourceType = "image" } = body;

    if (!publicId) {
      return NextResponse.json({ error: "Missing publicId parameter" }, { status: 400 });
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    console.error("Cloudinary delete error:", error);
    const message = error instanceof Error ? error.message : "Delete from Cloudinary failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
