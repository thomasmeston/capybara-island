import { Game } from './game/Game';
import './style.css';

const container = document.getElementById('game');
if (!container) throw new Error('Missing #game');

const game = new Game(container);
window.addEventListener('beforeunload', () => game.dispose());
