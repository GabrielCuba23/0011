import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('import_media',Path(__file__).resolve().parents[1]/'scripts/import_media.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class MediaImportTests(unittest.TestCase):
 def test_extract_bare_web_literal_newlines_and_hyperlink(self):
  urls=m.extract('WEB: cutivalu.pe \\n FB: https://www.facebook.com/radiocutivalu/', 'https://cutivalu.pe/')
  self.assertEqual(len(urls),2);self.assertIn('https://cutivalu.pe/',urls)
 def test_urls_are_data_and_credentials_or_private_addresses_are_rejected(self):
  for url in ['https://user:secret@example.com/','https://127.0.0.1/','https://evil.local/','https://example.com/?access_token=private']:
   self.assertIsNone(m.clean_url(url))
 def test_social_shorteners_and_directories_are_not_classified_as_web_feeds(self):
  self.assertEqual(m.link_type('https://www.facebook.com/test/'),'facebook');self.assertEqual(m.link_type('https://tinyurl.com/test'),'shortener');self.assertEqual(m.link_type('https://www.findglocal.com/test'),'directory');self.assertEqual(m.link_type('https://walac.pe/'),'website')
if __name__=='__main__':unittest.main()
