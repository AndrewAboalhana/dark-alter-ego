import { useGame } from './context/GameContext'
import SplashScreen from './screens/SplashScreen'
import OnboardScreen from './screens/OnboardScreen'
import HomeScreen from './screens/HomeScreen'
import LobbyScreen from './screens/LobbyScreen'
import GameScreen from './screens/GameScreen'
import ResultScreen from './screens/ResultScreen'
import SoloGameScreen from './screens/SoloGameScreen'

export default function App() {
  const { screen, loading } = useGame()

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0A0A0F' }}>
      <div style={{ fontSize:60, animation:'spin 1s linear infinite' }}>😈</div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const screens = {
    splash: <SplashScreen />,
    onboard: <OnboardScreen />,
    home: <HomeScreen />,
    lobby: <LobbyScreen />,
    game: <GameScreen />,
    result: <ResultScreen />,
    solo: <SoloGameScreen />,
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#060609', fontFamily:"'Tajawal', sans-serif", direction:'rtl', position:'relative', overflow:'hidden' }}>
      {/* Dark grid */}
      <div style={{ position:'fixed', inset:0, zIndex:0, backgroundImage:'linear-gradient(#ffffff06 1px, transparent 1px), linear-gradient(90deg, #ffffff06 1px, transparent 1px)', backgroundSize:'40px 40px', pointerEvents:'none' }} />
      {/* Red glow — top right */}
      <div style={{ position:'fixed', top:'-20%', right:'-15%', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle, #FF3B5C28, transparent 70%)', zIndex:0, animation:'glow 5s ease-in-out infinite', pointerEvents:'none' }} />
      {/* Purple glow — bottom left */}
      <div style={{ position:'fixed', bottom:'-20%', left:'-15%', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, #9B5DE530, transparent 70%)', zIndex:0, animation:'glow 7s ease-in-out infinite 2s', pointerEvents:'none' }} />
      {/* Extra deep shadow vignette */}
      <div style={{ position:'fixed', inset:0, zIndex:0, background:'radial-gradient(ellipse at center, transparent 40%, #000000aa 100%)', pointerEvents:'none' }} />
      <div style={{ width:'100%', maxWidth:420, minHeight:'100vh', display:'flex', flexDirection:'column', position:'relative', zIndex:1 }}>
        {screens[screen] || <SplashScreen />}
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body,#root{height:100%;}
        body{background:#060609;font-family:'Tajawal',sans-serif;}
        button{font-family:'Tajawal',sans-serif;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:#ffffff18;border-radius:4px;}
        @keyframes glow{0%,100%{opacity:.4}50%{opacity:1}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
      `}</style>
    </div>
  )
}
