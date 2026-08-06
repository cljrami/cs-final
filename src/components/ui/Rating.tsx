import { useState, useEffect } from 'react';

interface RatingProps {
  escortId: number;
  initialRating?: number;
  canVote?: boolean;
  onRatingSubmit?: (rating: number) => Promise<void>;
}

export default function Rating({ escortId, initialRating = 0, canVote = false, onRatingSubmit }: RatingProps) {
  const [rating, setRating] = useState(initialRating);
  const [hoverRating, setHoverRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userHasVoted, setUserHasVoted] = useState(false);

  useEffect(() => {
    const checkUserRating = async () => {
      if (!canVote) return;
      
      const token = localStorage.getItem('admin_token') || '';
      if (!token) return;
      
      try {
        const res = await fetch(`/api/escorts/rating-check.php?escort_id=${escortId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success && json.hasRated) {
          setUserHasVoted(true);
          setRating(json.rating);
        }
      } catch (err) {
        console.error('Error checking user rating:', err);
      }
    };
    
    checkUserRating();
  }, [escortId, canVote]);

  const handleRatingClick = async (newRating: number) => {
    if (canVote && onRatingSubmit) {
      setIsSubmitting(true);
      try {
        await onRatingSubmit(newRating);
        setRating(newRating);
        setUserHasVoted(true);
      } catch (error) {
        console.error('Error submitting rating:', error);
      } finally {
        setIsSubmitting(false);
      }
    } else if (!canVote) {
      setRating(newRating);
    }
  };

  const handleRatingHover = (hoveredRating: number) => {
    if (canVote) {
      setHoverRating(hoveredRating);
    }
  };

  const handleMouseLeave = () => {
    if (canVote) {
      setHoverRating(0);
    }
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <button
          key={i}
          type="button"
          onClick={() => handleRatingClick(i)}
          onMouseEnter={() => handleRatingHover(i)}
          onMouseLeave={handleMouseLeave}
          disabled={isSubmitting}
          className={`p-1.5 rounded-full transition-all duration-200 
            ${canVote ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}
            ${rating >= i || hoverRating >= i
              ? 'text-yellow-400 scale-110'
              : 'text-gray-400 hover:text-yellow-400'}
            ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <i className="fas fa-star text-sm"></i>
        </button>
      );
    }
    return stars;
  };

  return (
    <div className="flex flex-col items-center w-full">
      <div className={`flex items-center gap-1.5 mb-2 ${canVote ? 'cursor-pointer' : ''}`}>
        {renderStars()}
        {isSubmitting && (
          <div className="ml-2">
            <i className="fas fa-spinner fa-spin text-yellow-400"></i>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2 text-gray-400 text-xs">
        {rating > 0 && <span className="font-medium text-white">{rating.toFixed(1)}</span>}
        <span>(Ranking de 1 a 5 estrellas)</span>
      </div>

      {canVote && !userHasVoted && (
        <div className="mt-2 text-center">
          {isSubmitting ? (
            <div className="flex items-center gap-2 text-xs text-yellow-400">
              <i className="fas fa-spinner fa-spin"></i>
              <span>Enviando tu calificación...</span>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Haz clic en las estrellas para calificar</p>
          )}
        </div>
      )}

      {canVote && userHasVoted && (
        <div className="mt-2 text-center">
          <span className="text-xs text-green-400">✓ Gracias por tu calificación</span>
        </div>
      )}
    </div>
  );
}
