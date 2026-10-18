import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <code className="text-4xl font-bold text-primary">404</code>
      <p className="text-muted-foreground">This route 400s harder than a0.</p>
      <Button asChild variant="outline">
        <Link to="/">back to a0</Link>
      </Button>
    </div>
  );
}
