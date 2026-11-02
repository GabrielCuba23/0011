import datetime as dt
import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('collect',Path(__file__).resolve().parents[1]/'scripts/collect.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
class CollectionTests(unittest.TestCase):
 def test_news_window(self):
  now=dt.datetime(2026,11,2,15,tzinfo=dt.timezone.utc)
  xml='<rss><channel>'+''.join(f'<item><title>Lluvias en Tumbes</title><link>https://example.com/{i}</link><pubDate>{date}</pubDate><source>Prensa</source></item>' for i,date in enumerate(['Mon, 02 Nov 2026 14:00:00 GMT','Sun, 01 Nov 2026 14:00:00 GMT','Tue, 03 Nov 2026 14:00:00 GMT','invalid']))+'</channel></rss>'
  rows=c.parse_rss(xml,now);self.assertEqual(len(rows),1);self.assertEqual(rows[0]['regions'],['Tumbes']);self.assertEqual(rows[0]['kind'],'news')
 def test_geography_boundaries_and_accents(self):
  self.assertEqual(c.regions('Áncash, San Martin y Piura'),['Áncash','Piura','San Martín']);self.assertEqual(c.regions('Clima en el país'),[])
 def test_hydro_preserves_source_fields_without_inventing_publication_date(self):
  rows=c.parse_hydro({'data':[{'id':123,'title':'Aviso hidrológico','waterBody':'Zarumilla','department':'Tumbes','stationName':'Estación de prueba','startDate':'2026-11-02'}]})
  self.assertEqual(rows[0]['regions'],['Tumbes']);self.assertIsNone(rows[0]['publishedAt']);self.assertIn('Zarumilla',rows[0]['summary'])
  with self.assertRaises(ValueError):c.parse_hydro({'data':{'unexpected':'format'}})
 def test_optional_html_attributes(self):
  self.assertEqual(c.parse_official('<a href><img alt></a>','https://example.com','test'),[])
 def test_official_navigation_is_not_a_publication(self):
  rows=c.parse_official('<a href="/boletines">Boletines y documentos oficiales</a><a href="/aviso.pdf">Aviso hidrológico de Tumbes</a><a href="javascript:alert(1)">Comunicado de alerta importante</a>','https://example.com/','SENAMHI')
  self.assertEqual(len(rows),1);self.assertIsNone(rows[0]['publishedAt']);self.assertEqual(rows[0]['regions'],['Tumbes'])
if __name__=='__main__':unittest.main()
