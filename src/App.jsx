import { useGame } from './context/GameContext'
import SplashScreen from './screens/SplashScreen'
import OnboardScreen from './screens/OnboardScreen'
import HomeScreen from './screens/HomeScreen'
import LobbyScreen from './screens/LobbyScreen'
import GameScreen from './screens/GameScreen'
import ResultScreen from './screens/ResultScreen'

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
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0A0A0F', fontFamily:"'Tajawal', sans-serif", direction:'rtl', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'fixed', inset:0, zIndex:0, backgroundImage:'linear-gradient(#ffffff08 1px, transparent 1px), linear-gradient(90deg, #ffffff08 1px, transparent 1px)', backgroundSize:'40px 40px', pointerEvents:'none' }} />
      <div style={{ position:'fixed', top:'-15%', right:'-10%', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, #FF3B5C18, transparent 70%)', zIndex:0, animation:'glow 5s ease-in-out infinite', pointerEvents:'none' }} />
      <div style={{ position:'fixed', bottom:'-15%', left:'-10%', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, #9B5DE518, transparent 70%)', zIndex:0, animation:'glow 6s ease-in-out infinite 1.5s', pointerEvents:'none' }} />
      <div style={{ width:'100%', maxWidth:420, minHeight:'100vh', display:'flex', flexDirection:'column', position:'relative', zIndex:1 }}>
        {screens[screen] || <SplashScreen />}
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body,#root{height:100%;}
        body{background:#0A0A0F;font-family:'Tajawal',sans-serif;}
        button{font-family:'Tajawal',sans-serif;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:#ffffff20;border-radius:4px;}
        @keyframes glow{0%,100%{opacity:.3}50%{opacity:.7}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
      `}</style>
    </div>
  )
}
