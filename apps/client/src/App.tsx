import { useApp } from './core/store';
import { GameCanvas } from './scene/GameCanvas';
import { BootScreen } from './ui/screens/BootScreen';
import { DerbyScreen } from './ui/screens/DerbyScreen';
import { ProfileScreen } from './ui/screens/ProfileScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { Toasts } from './ui/Toasts';

export function App() {
  const screen = useApp((s) => s.screen);
  return (
    <>
      <GameCanvas />
      <div className="ui-root">
        {screen === 'boot' && <BootScreen />}
        {screen === 'track' && <DerbyScreen />}
        {screen === 'profile' && <ProfileScreen />}
        {screen === 'settings' && <SettingsScreen />}
        <Toasts />
      </div>
    </>
  );
}
