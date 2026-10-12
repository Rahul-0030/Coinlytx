import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // =====================================================
    // AUTHENTICATION
    // =====================================================

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized. Please log in again.",
        },
        { status: 401 }
      );
    }

    // =====================================================
    // GET FILE
    // =====================================================

    const formData = await request.formData();

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "No image file was provided.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // VALIDATE FILE TYPE
    // =====================================================

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid image type. Use JPG, PNG, WebP or AVIF.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // VALIDATE FILE SIZE
    // =====================================================

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "Image must be smaller than 10 MB.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // GENERATE SAFE FILE NAME
    // =====================================================

    const extension =
      file.name.split(".").pop()?.toLowerCase() || "jpg";

    const originalName = file.name
      .replace(/\.[^/.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);

    const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${
      originalName || "article-image"
    }.${extension}`;

    const storagePath = `featured/${uniqueName}`;

    // =====================================================
    // CONVERT FILE
    // =====================================================

    const arrayBuffer = await file.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer);

    // =====================================================
    // UPLOAD TO SUPABASE STORAGE
    // =====================================================

    const { data: uploadData, error: uploadError } =
      await supabase.storage
        .from("article-images")
        .upload(storagePath, buffer, {
          contentType: file.type,
          cacheControl: "31536000",
          upsert: false,
        });

    if (uploadError) {
      console.error(
        "IMAGE UPLOAD ERROR:",
        uploadError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to upload image.",
          details: uploadError.message,
        },
        { status: 500 }
      );
    }

    // =====================================================
    // GET PUBLIC URL
    // =====================================================

    const {
      data: publicUrlData,
    } = supabase.storage
      .from("article-images")
      .getPublicUrl(uploadData.path);

    const publicUrl =
      publicUrlData.publicUrl;

    // =====================================================
    // SUCCESS
    // =====================================================

    return NextResponse.json({
      success: true,

      message:
        "Featured image uploaded successfully.",

      image: {
        url: publicUrl,
        path: uploadData.path,
        name: file.name,
        type: file.type,
        size: file.size,
      },
    });
  } catch (error) {
    console.error(
      "UPLOAD IMAGE API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Image upload failed.",
        details:
          error instanceof Error
            ? error.message
            : "Unknown server error.",
      },
      { status: 500 }
    );
  }
}