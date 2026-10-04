import { render } from 'preact';
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles/main.css';
import { App } from './ui/App';
import { store } from './ui/store';

store.start();
render(<App />, document.getElementById('app')!);
