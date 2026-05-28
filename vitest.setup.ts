import '@testing-library/jest-dom/vitest';

// jsdom은 document.execCommand를 구현하지 않으므로 spyOn 대상 슬롯만 마련.
// 실제 동작은 각 테스트의 mockImplementation으로 덮어쓴다.
if (typeof document !== 'undefined' && typeof document.execCommand !== 'function') {
  document.execCommand = () => false;
}
