import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const GameContext = createContext(null)

export function GameProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState('splash')
  const [room, setRoom] = useState(null)
  const [myPlayer, setMyPlayer] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    setLoading(false)
  }

  const signInAnonymously = async (username, avatar) => {
    const randomEmail = `${Math.random().toString(36).slice(2)}@darkego.game`
    const randomPass = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)

    const { data, error } = await supabase.auth.signUp({
      email: randomEmail,
      password: randomPass,
      options: { data: { username, avatar } }
    })
    if (error) throw error
    return data
  }

  const goTo = (s) => setScreen(s)

  return (
    <GameContext.Provider value={{
      user, profile, loading, screen, room, myPlayer,
      setRoom, setMyPlayer, setProfile, goTo, signInAnonymously, fetchProfile
    }}>
      {children}
    </GameContext.Provider>
  )
}

export const useGame = () => useContext(GameContext)
