import fs from 'fs';
import path from 'path';

describe('Customer Return OTP Toast Dismiss Button Tests', () => {
  const customerLayoutPath = path.resolve(process.cwd(), 'src/modules/customer/components/layout/CustomerLayout.jsx');
  const fileContent = fs.readFileSync(customerLayoutPath, 'utf8');

  test('CustomerLayout imports X icon from lucide-react', () => {
    expect(fileContent).toMatch(/import\s*\{[^}]*X[^}]*\}\s*from\s*['"]lucide-react['"]/);
  });

  test('Return Pickup OTP toast includes dismiss button with toast.dismiss', () => {
    expect(fileContent).toContain('Return Pickup OTP');
    expect(fileContent).toMatch(/onClick=\{[()=>\s]*toast\.dismiss\(t\)\}/);
    expect(fileContent).toContain('aria-label="Close alert"');
  });

  test('Return Received Alert toast includes dismiss button with toast.dismiss', () => {
    expect(fileContent).toContain('Return Received Alert');
    // Ensure both pickup and drop have the cross button
    const occurrences = (fileContent.match(/aria-label="Close alert"/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });
});
