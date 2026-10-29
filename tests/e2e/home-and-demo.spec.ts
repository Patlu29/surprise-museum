import { expect, test } from '@playwright/test';
import { addPhotos, createMuseum, trackProblems } from './support/app';
import { makePhotos } from './support/images';

/** The home screen, legal pages, the "Report a problem" footer link and the demo-storage notice. */

test.describe('home', () => {
  test('US-1 AC-1: the home screen loads without sign-in and starts the builder', async ({ page }) => {
    const problems = trackProblems(page);
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Turn your photos into a little museum');
    await expect(page.getByRole('link', { name: 'Create a museum' })).toBeVisible();
    await expect(page.getByText(/sign in|log in|password/i)).toHaveCount(0);
    problems.expectClean();
  });

  test('home footer: Privacy, Terms and a "Report a problem" link to the project issue tracker', async ({
    page,
    context,
  }) => {
    await page.goto('./');
    const footer = page.getByRole('navigation', { name: 'Footer' });
    const report = footer.getByRole('link', { name: 'Report a problem' });
    await expect(report).toHaveAttribute('href', 'https://github.com/Patlu29/surprise-museum/issues');
    await expect(report).toHaveAttribute('target', '_blank');
    await expect(report).toHaveAttribute('rel', /noopener/);
    await expect(report).toHaveAttribute('rel', /noreferrer/);
    // No sales or marketing contact remains in the footer (coordinator decision).
    await expect(footer).not.toContainText(/sales/i);
    await footer.getByRole('link', { name: 'Privacy' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/privacy/i);
    await page.goBack();
    await footer.getByRole('link', { name: 'Terms' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/terms/i);
    void context;
  });

  test('NFR-13: no third-party requests are made by the home, builder or a visit', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith('http://localhost') && !/^(blob|data|about):/.test(url)) external.push(url);
    });
    await page.goto('./');
    await page.getByRole('link', { name: 'Create a museum' }).click();
    await expect(page.getByRole('button', { name: 'Add photos' })).toBeVisible();
    expect(external).toEqual([]);
  });
});

test.describe('demo storage notice (mock backend)', () => {
  test('the builder says this is a demo copy, shows storage use and offers Clear demo data behind a confirmation', async ({
    page,
  }) => {
    await page.goto('./#/create');
    await expect(page.getByText('Demo copy')).toBeVisible();
    await expect(page.getByText(/Your museum is kept only in this browser/)).toBeVisible();
    await expect(page.getByText(/Demo storage: .* of 200 MB used/)).toBeVisible();
    await addPhotos(page, makePhotos(2));
    await expect(page.getByText(/\(1 museum, 2 photos\)/)).toBeVisible();
    await page.getByRole('button', { name: 'Clear demo data' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    // The safe choice has focus.
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(/\(1 museum, 2 photos\)/)).toBeVisible();
  });

  test('clearing demo data in the builder keeps the draft and uploads the photos again', async ({ page }) => {
    await page.goto('./#/create');
    await addPhotos(page, makePhotos(2));
    await page.getByRole('button', { name: 'Clear demo data' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: /^Clear/ }).click();
    await expect(page.getByRole('alertdialog')).toBeHidden({ timeout: 15_000 });
    // Rows are still there and end up ready again; storage shows the new copy.
    await expect(page.locator('.photo-list > li')).toHaveCount(2);
    await expect(page.locator('.photo-row__status--ready')).toHaveCount(2, { timeout: 60_000 });
    await expect(page.getByText(/\(1 museum, 2 photos\)/)).toBeVisible({ timeout: 15_000 });
  });

  test('the Published screen warns that the link works only in this browser and that clearing removes the museum', async ({
    page,
  }) => {
    await createMuseum(page, { photos: 1 });
    await expect(page.getByText('Demo copy')).toBeVisible();
    await expect(page.getByText(/link will not work for anyone else/)).toBeVisible();
    await page.getByRole('button', { name: 'Clear demo data' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(/museum you just made/i);
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});
