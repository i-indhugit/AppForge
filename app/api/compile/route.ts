import { NextResponse } from 'next/server';
import { CompilerService } from '@/lib/compilerService';
import { AuthService } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    // 1. Authentication Check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ status: "FAILED", error: "Authentication required" }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = await AuthService.verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ status: "FAILED", error: "Invalid or expired token" }, { status: 401 });
    }

    const { prompt, api_key, force_mock } = await request.json();
    
    // 2. Input Validation
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return NextResponse.json({ 
        status: "FAILED", 
        error: "Missing required field: 'prompt' must be a non-empty string." 
      }, { status: 400 });
    }

    // 3. API Key Validation (if not in mock mode)
    if (!force_mock) {
      if (!api_key || typeof api_key !== 'string' || api_key.trim() === '') {
        return NextResponse.json({ 
          status: "FAILED", 
          error: "API Key is required when mock mode is disabled." 
        }, { status: 400 });
      }
    }

    const output = await CompilerService.compile(prompt, api_key, force_mock);
    return NextResponse.json(output);
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ status: "FAILED", error: message }, { status: 500 });
  }
}
