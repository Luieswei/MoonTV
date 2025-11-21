/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const url = request.nextUrl; // 获取完整的URL对象
  const { pathname } = url;

  // ===========================================
  // 🎯 【新增的域名自动跳转逻辑】
  // ===========================================

  // 1. 获取重定向目标域名和当前主机名
  const REDIRECT_TARGET = process.env.REDIRECT_TARGET;
  const currentHostname = url.hostname;

  // 2. 检查是否需要重定向：
  //    条件：当前主机名以 .pages.dev 结尾 (Cloudflare Pages 默认域名) 
  //    且 REDIRECT_TARGET 环境变量已设置
  if (currentHostname.endsWith('.pages.dev') && REDIRECT_TARGET) {
    
    // 3. 构建目标 URL（必须使用 https 协议）
    //    保留完整的路径和查询参数 (url.pathname + url.search)
    const targetUrl = `https://${REDIRECT_TARGET}${url.pathname}${url.search}`;
    
    // 4. 执行 301 永久重定向
    //    这是最高优先级，确保 Pages.dev 域名直接跳转到自定义域名
    return NextResponse.redirect(targetUrl, 301);
  }

  // ===========================================
  // 原始认证逻辑 (域名跳转完成后才执行)
  // ===========================================

  // 跳过不需要认证的路径 (保留你的原有逻辑)
  if (shouldSkipAuth(pathname)) {
    return NextResponse.next();
  }
  
  // [ 后续的认证逻辑保持不变... ]
  
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  if (!process.env.PASSWORD) {
    // 如果没有设置密码，重定向到警告页面
    const warningUrl = new URL('/warning', request.url);
    return NextResponse.redirect(warningUrl);
  }

  // 从cookie获取认证信息
  const authInfo = getAuthInfoFromCookie(request);

  if (!authInfo) {
    return handleAuthFailure(request, pathname);
  }

  // localstorage模式：在middleware中完成验证
  if (storageType === 'localstorage') {
    if (!authInfo.password || authInfo.password !== process.env.PASSWORD) {
      return handleAuthFailure(request, pathname);
    }
    return NextResponse.next();
  }

  // 其他模式：只验证签名
  // 检查是否有用户名（非localStorage模式下密码不存储在cookie中）
  if (!authInfo.username || !authInfo.signature) {
    return handleAuthFailure(request, pathname);
  }

  // 验证签名（如果存在）
  if (authInfo.signature) {
    const isValidSignature = await verifySignature(
      authInfo.username,
      authInfo.signature,
      process.env.PASSWORD || ''
    );

    // 签名验证通过即可
    if (isValidSignature) {
      return NextResponse.next();
    }
  }

  // 签名验证失败或不存在签名
  return handleAuthFailure(request, pathname);
}

// [其余的函数，如 verifySignature, handleAuthFailure, shouldSkipAuth, config 保持不变 ]

// 验证签名
async function verifySignature(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  try {
    // 导入密钥
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // 将十六进制字符串转换为Uint8Array
    const signatureBuffer = new Uint8Array(
      signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );

    // 验证签名
    return await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBuffer,
      messageData
    );
  } catch (error) {
    console.error('签名验证失败:', error);
    return false;
  }
}

// 处理认证失败的情况
function handleAuthFailure(
  request: NextRequest,
  pathname: string
): NextResponse {
  // 如果是 API 路由，返回 401 状态码
  if (pathname.startsWith('/api')) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 否则重定向到登录页面
  const loginUrl = new URL('/login', request.url);
  // 保留完整的URL，包括查询参数
  const fullUrl = `${pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set('redirect', fullUrl);
  return NextResponse.redirect(loginUrl);
}

// 判断是否需要跳过认证的路径
function shouldSkipAuth(pathname: string): boolean {
  const skipPaths = [
    '/_next',
    '/favicon.ico',
    '/robots.txt',
    '/manifest.json',
    '/icons/',
    '/logo.png',
    '/screenshot.png',
  ];

  return skipPaths.some((path) => pathname.startsWith(path));
}

// 配置middleware匹配规则
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|warning|api/login|api/register|api/logout|api/cron|api/server-config).*)',
  ],
};
