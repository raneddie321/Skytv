import { useParams } from 'react-router-dom';
import { MovieDetailView } from '@/screens/detail/MovieDetail';
import { SeriesDetailView } from '@/screens/detail/SeriesDetail';

export default function KidsDetail() {
  const { type, id = '' } = useParams();
  const decoded = decodeURIComponent(id);
  return type === 'movie' ? <MovieDetailView key={decoded} id={decoded} kids /> : <SeriesDetailView key={decoded} id={decoded} kids />;
}
