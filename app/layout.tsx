import type { Metadata, Viewport } from "next"; import "./globals.css";
export const metadata:Metadata={title:"TigerMove | Stone vs Wood",description:"Play TigerMove, a timeless strategy game of position, patience and capture by Quantum Leaf Automation.",applicationName:"TigerMove",manifest:"/manifest.webmanifest",appleWebApp:{capable:true,statusBarStyle:"black-translucent",title:"TigerMove"},icons:{icon:"/icon.svg",apple:"/icon.svg"}};
export const viewport:Viewport={themeColor:"#183f2b",width:"device-width",initialScale:1,viewportFit:"cover"};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
