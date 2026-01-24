import { useNavigate } from 'react-router-dom';

export function useGameNavigate() {
  const navigate = useNavigate();

  const gameNavigate = async (to: string) => {
    navigate(to);
  };

  return gameNavigate;
}
