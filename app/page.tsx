import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Compass, Heart, MapPinned, Waves } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { TripSearch } from "@/components/trip-search";
import { Floating, Reveal } from "@/components/motion";

const places = [
  { name: "Amalfi Coast", country: "Italy", note: "Sea air & slow afternoons", image: "https://images.unsplash.com/photo-1533587851505-d119e13fa0d7?auto=format&fit=crop&w=1000&q=85", tag: "For the romantics" },
  { name: "Kyoto", country: "Japan", note: "Quiet streets, rich stories", image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1000&q=85", tag: "For the curious" },
  { name: "Tulum", country: "Mexico", note: "Barefoot days & blue water", image: "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=1000&q=85", tag: "For the sun seekers" },
  { name: "Lisbon", country: "Portugal", note: "Good food, better wandering", image: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1000&q=85", tag: "For the city lovers" },
];

export default function Home() {
  return (
    <main>
      <SiteHeader />
      <section className="hero shell">
        <div className="hero-copy">
          <Reveal>
            <div className="hero-kicker"><span className="kicker-line" /> A MORE THOUGHTFUL WAY TO GET AWAY</div>
            <h1>Go somewhere<br /><em>that feels like you.</em></h1>
            <p className="hero-description">The best trips aren’t just booked. They’re put together around the way you want to feel, explore, and spend.</p>
            <div className="hero-actions">
              <Link href="#plan" className="button button-dark">Plan your getaway <ArrowUpRight size={17} /></Link>
              <Link href="#discover" className="text-link">Find a little inspiration <ArrowDownRight size={16} /></Link>
            </div>
            <div className="hero-proof"><span className="proof-compass"><Compass size={18} /></span><div><strong>Thoughtful plans. Your pace.</strong><small>Not another one-size-fits-all search.</small></div></div>
          </Reveal>
        </div>
        <div className="hero-visual">
          <Reveal delay={0.12} className="hero-photo-wrap">
            <div className="hero-photo" role="img" aria-label="Sunlit Mediterranean coastline with turquoise water" />
            <div className="photo-shade" />
            <div className="hero-photo-caption"><span>THE ART OF GETTING AWAY</span><strong>Take the scenic route.</strong></div>
          </Reveal>
          <Floating className="float-note float-note-top"><span className="float-icon"><Compass size={16} /></span><span><strong>Your trip, your pace</strong><small>Plans with room to breathe</small></span></Floating>
          <Floating className="float-note float-note-bottom"><span className="sun-icon"><Sun size={17} /></span><span><strong>Somewhere warmer?</strong><small>We know a few places.</small></span></Floating>
          <div className="image-index">01 <span /> 04</div>
        </div>
      </section>

      <section className="planner-section shell">
        <Reveal><TripSearch /></Reveal>
      </section>

      <section className="discover-section section-space" id="discover">
        <div className="shell">
          <Reveal className="section-heading-row">
            <div><span className="eyebrow">A WORLD OF POSSIBILITIES</span><h2>Somewhere is calling.<br /><em>Let’s find out where.</em></h2></div>
            <p>Not sure where to go? Start with a feeling. We’ll help turn it into a place, a plan, and a trip that makes sense.</p>
          </Reveal>
          <div className="destination-grid">
            {places.map((place, i) => (
              <Reveal key={place.name} delay={i * 0.07} className={`destination-card destination-card-${i + 1}`}>
                <div className="destination-image" style={{ backgroundImage: `url('${place.image}')` }} />
                <div className="destination-overlay" />
                <span className="destination-tag">{place.tag}</span>
                <div className="destination-copy"><span>{place.country}</span><h3>{place.name}</h3><p>{place.note}</p></div>
                <span className="destination-arrow"><ArrowUpRight size={18} /></span>
              </Reveal>
            ))}
          </div>
          <p className="section-disclaimer">A little inspiration to get started. Destination suggestions are curated examples, not live travel offers.</p>
        </div>
      </section>

      <section className="how-section section-space" id="how-it-works">
        <div className="shell how-grid">
          <Reveal className="how-intro">
            <span className="eyebrow">LESS TAB-HOPPING. MORE DAYDREAMING.</span>
            <h2>From “we should go”<br />to <em>“when do we leave?”</em></h2>
            <p>Tripfinder brings the moving parts together, so you can spend less time comparing ten different sites and more time looking forward to the trip.</p>
            <Link href="#plan" className="text-link dark-link">Start planning <ArrowUpRight size={16} /></Link>
          </Reveal>
          <div className="steps-list">
            <Reveal className="step-item" delay={0.05}><span className="step-number">01</span><div><h3>Tell us what matters.</h3><p>Your dates, budget, travel crew, must-haves and the kind of holiday you have in mind.</p></div><MapPinned size={22} /></Reveal>
            <Reveal className="step-item" delay={0.12}><span className="step-number">02</span><div><h3>Explore trips that fit.</h3><p>Compare destination ideas, travel options, places to stay and things worth doing.</p></div><Waves size={22} /></Reveal>
            <Reveal className="step-item" delay={0.19}><span className="step-number">03</span><div><h3>Make it yours.</h3><p>Shape the itinerary, understand the full estimated cost and follow links to booking providers.</p></div><Heart size={22} /></Reveal>
          </div>
        </div>
      </section>

      <section className="quote-section" id="about">
        <div className="quote-image" />
        <div className="quote-content shell">
          <Reveal><span className="eyebrow light-eyebrow">A BETTER WAY TO PLAN</span><p>“A great trip should fit your life — not the other way around.”</p><span className="quote-caption">Thoughtful travel starts with the details.</span></Reveal>
        </div>
      </section>

      <section className="closing-section shell">
        <Reveal className="closing-content"><span className="eyebrow">YOUR NEXT STORY IS OUT THERE</span><h2>Ready when <em>you are.</em></h2><p>Start with a few details. We’ll help you figure out the rest.</p><Link href="#plan" className="button button-dark">Let’s plan a trip <ArrowRight size={17} /></Link></Reveal>
        <div className="closing-mark"><Compass size={125} strokeWidth={0.65} /></div>
      </section>

      <footer className="site-footer shell">
        <div className="footer-top"><div><span className="brand-name footer-brand">tripfinder<span className="brand-period">.</span></span><p>Make room for somewhere new.</p></div><div className="footer-links"><Link href="#discover">Discover</Link><Link href="#how-it-works">How it works</Link><Link href="#plan">Plan a trip</Link></div></div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} Tripfinder. All good journeys begin somewhere.</span><span>Planning inspiration, not a booking agency.</span></div>
      </footer>
    </main>
  );
}
