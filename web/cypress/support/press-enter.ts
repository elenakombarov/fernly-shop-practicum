// cy.press(Enter) sends key and code, but not Enter's key code, so Chromium
// does not activate a native button. This press includes that code.
export function pressEnter() {
  const keyCode = 13;
  const key = {
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  };

  cy.focused().should(($el) => {
    expect($el[0]?.tagName, 'focused control').to.equal('BUTTON');
  });

  cy.then(() =>
    Cypress.automation('remote:debugger:protocol', {
      command: 'Input.dispatchKeyEvent',
      params: { type: 'rawKeyDown', ...key },
    }),
  );
  cy.then(() =>
    Cypress.automation('remote:debugger:protocol', {
      command: 'Input.dispatchKeyEvent',
      params: { type: 'char', text: '\r', unmodifiedText: '\r', ...key },
    }),
  );
  cy.then(() =>
    Cypress.automation('remote:debugger:protocol', {
      command: 'Input.dispatchKeyEvent',
      params: { type: 'keyUp', ...key },
    }),
  );
}
