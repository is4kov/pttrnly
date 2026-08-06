import { configureStore } from '@reduxjs/toolkit';
import { themeReducer } from '../features/theme/themeSlice';
import { patternReducer } from '../features/pattern/patternSlice';

export const store = configureStore({
  reducer: {
    theme: themeReducer,
    pattern: patternReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
