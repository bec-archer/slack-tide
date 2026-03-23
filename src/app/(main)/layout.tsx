import { AuthProvider } from "@/contexts/AuthContext";
import { ShopProvider } from "@/contexts/ShopContext";
import Nav from "@/components/Nav";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider>
      <ShopProvider>
        <Nav />
        {children}
      </ShopProvider>
    </AuthProvider>
  );
}
