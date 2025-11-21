export async function onRequest(context) {
  const url = new URL(context.request.url);

  // 【重要】在这里填入你的自定义域名，不要带 https://
  const targetDomain = "tvtest.aungminweiguo.dpdns.org";

  // 检查当前访问的域名是否包含 pages.dev
  // 如果是原生域名，就执行跳转
  if (url.hostname.endsWith(".pages.dev")) {
    
    // 将目标替换为你的自定义域名
    url.hostname = targetDomain;
    
    // 执行 301 永久重定向 (对 SEO 友好)
    return Response.redirect(url.toString(), 301);
  }

  // 如果已经是自定义域名，则不做任何操作，正常放行
  return context.next();
}
