"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock, Bell } from "lucide-react";
import { getOrCreateResidentProfile } from "@/lib/residents";
import { useNotifications } from "@/hooks/use-notifications";
import {
  getRequestTypeTitle,
  getRequestStatusClassName,
  getRequestStatusLabel,
} from "@/lib/request-types";

interface DashboardStats {
  totalRequests: number;
  totalComplaints: number;
  pendingRequests: number;
  resolvedRequests: number;
  openComplaints: number;
  inProgressComplaints: number;
  resolvedComplaints: number;
}

interface RecentRequest {
  id: string;
  title: string;
  category: string;
  status: string;
  created_at: string;
  request_type?: string | null;
}

interface RecentComplaint {
  id: string;
  title: string;
  category: string;
  status: string;
  created_at: string;
}

export default function CitizenDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalRequests: 0,
    totalComplaints: 0,
    pendingRequests: 0,
    resolvedRequests: 0,
    openComplaints: 0,
    inProgressComplaints: 0,
    resolvedComplaints: 0,
  });
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>("");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([]);
  const [recentComplaints, setRecentComplaints] = useState<RecentComplaint[]>(
    [],
  );
  const { unreadCount } = useNotifications();

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          setUserName(
            user.user_metadata?.first_name ||
              user.email?.split("@")[0] ||
              "Resident",
          );
        }

        const resident = user
          ? await getOrCreateResidentProfile(supabase, user)
          : null;

        if (resident) {
          const { data: requests, error: requestsError } = await supabase
            .from("requests")
            .select("*")
            .eq("resident_id", resident.id);

          const { data: complaints, error: complaintsError } = await supabase
            .from("complaints")
            .select("*")
            .eq("resident_id", resident.id);

          if (requestsError) {
            throw requestsError;
          }
          if (complaintsError) {
            throw complaintsError;
          }

          const totalRequests = requests?.length || 0;
          const totalComplaints = complaints?.length || 0;
          const pendingRequests =
            requests?.filter((r) => r.status === "pending").length || 0;
          const resolvedRequests =
            requests?.filter((r) =>
              ["approved", "rejected", "resolved"].includes(r.status),
            ).length || 0;
          const openComplaints =
            complaints?.filter((c) => c.status === "open").length || 0;
          const inProgressComplaints =
            complaints?.filter((c) => c.status === "in-progress").length || 0;
          const resolvedComplaints =
            complaints?.filter((c) => c.status === "resolved").length || 0;

          const recentReqs =
            requests
              ?.sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime(),
              )
              .slice(0, 3)
              .map((r) => ({
                id: r.id,
                title: r.title,
                category: r.category,
                status: r.status,
                created_at: r.created_at,
                request_type: r.request_type,
              })) || [];

          const recentComps =
            complaints
              ?.sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime(),
              )
              .slice(0, 3)
              .map((c) => ({
                id: c.id,
                title: c.title,
                category: c.category,
                status: c.status,
                created_at: c.created_at,
              })) || [];

          setRecentRequests(recentReqs);
          setRecentComplaints(recentComps);

          setStats({
            totalRequests,
            totalComplaints,
            pendingRequests,
            resolvedRequests,
            openComplaints,
            inProgressComplaints,
            resolvedComplaints,
          });
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : error && typeof error === "object" && "message" in error
              ? String((error as Record<string, unknown>).message)
              : JSON.stringify(error);
        console.error("Error loading dashboard data:", errorMessage, error);
        setFetchError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {userName}! 👋</h1>
          <p className="text-muted-foreground mt-2">
            Here&apos;s an overview of your civic activities
          </p>
        </div>
        <Link href="/citizen/notifications">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </Button>
        </Link>
      </div>

      {/* Error Display */}
      {fetchError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-semibold">Error loading dashboard:</p>
          <p className="text-sm">{fetchError}</p>
        </div>
      )}

      {/* Stats Grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Requests
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRequests}</div>
              <p className="text-xs text-muted-foreground">
                Service requests submitted
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingRequests}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting processing
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.resolvedRequests}</div>
              <p className="text-xs text-muted-foreground">
                Successfully completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                My Complaints
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-2xl font-bold">{stats.totalComplaints}</div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-yellow-600">
                  {stats.openComplaints} open
                </span>
                <span className="text-blue-600">
                  {stats.inProgressComplaints} in-progress
                </span>
                <span className="text-primary">
                  {stats.resolvedComplaints} resolved
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Get started with a new service request or complaint
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Link href="/citizen/request-service">
            <Button className="bg-primary hover:bg-primary/90">
              + New Service Request
            </Button>
          </Link>
          <Link href="/citizen/file-complaint">
            <Button variant="outline">+ File Complaint</Button>
          </Link>
          <Link href="/citizen/my-requests">
            <Button variant="outline">View My Requests</Button>
          </Link>
          <Link href="/citizen/my-complaints">
            <Button variant="outline">View My Complaints</Button>
          </Link>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      {!loading &&
      (recentRequests.length > 0 || recentComplaints.length > 0) ? (
        <div className="grid gap-4 md:grid-cols-2">
          {recentRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Requests</CardTitle>
                <CardDescription>Your latest service requests</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {getRequestTypeTitle(
                          request.request_type,
                          request.title,
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      className={`text-xs ${getRequestStatusClassName(request.status)}`}
                    >
                      {getRequestStatusLabel(request.status)}
                    </Badge>
                  </div>
                ))}
                <Link href="/citizen/my-requests" className="block pt-2">
                  <Button variant="ghost" size="sm" className="w-full">
                    View All Requests
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {recentComplaints.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Complaints</CardTitle>
                <CardDescription>Your latest complaints</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentComplaints.map((complaint) => (
                  <div
                    key={complaint.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {complaint.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(complaint.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      className={`text-xs ${
                        complaint.status === "resolved"
                          ? "bg-primary/10 text-primary border-primary/20"
                          : complaint.status === "in-progress"
                            ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
                            : "bg-yellow-500/10 text-yellow-700 border-yellow-500/20"
                      }`}
                    >
                      {complaint.status.charAt(0).toUpperCase() +
                        complaint.status.slice(1)}
                    </Badge>
                  </div>
                ))}
                <Link href="/citizen/my-complaints" className="block pt-2">
                  <Button variant="ghost" size="sm" className="w-full">
                    View All Complaints
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      ) : !loading &&
        stats.totalRequests === 0 &&
        stats.totalComplaints === 0 ? (
        <Card className="bg-blue-50/50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-base">
              Welcome to your dashboard!
            </CardTitle>
            <CardDescription>
              You haven't submitted any requests or complaints yet. Get started
              with your first civic action.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Link href="/citizen/request-service">
              <Button size="sm">Request a Service</Button>
            </Link>
            <Link href="/citizen/file-complaint">
              <Button variant="outline" size="sm">
                File a Complaint
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
