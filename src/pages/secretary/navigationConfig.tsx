import { LayoutDashboard, ClipboardList, AlertTriangle, DollarSign, CreditCard, Shield, Landmark, Crown, FileText, Building2, Users, Network, Bell, Briefcase, LogOut, ChevronRight, Activity } from 'lucide-react'

type Section =
  | 'dashboard'
  | 'intake'
  | 'finance'
  | 'governance'
  | 'community'
  | 'administration'
  | 'security'

type View =
  | 'overview'
  | 'intake_queue'
  | 'reports'
  | 'alerts'
  | 'elections'
  | 'proposals'
  | 'neighbors'
  | 'partners'
  | 'ads'
  | 'staff'

interface NavigationItem {
  id: View
  label: string
  icon: React.ReactNode
}

interface NavigationGroup {
  id: Section
  title: string
  icon: React.ReactNode
  items: NavigationItem[]
}

export const navigation: NavigationGroup[] = [
  {
    id: 'dashboard',
    title: 'Overview',
    icon: <LayoutDashboard className="w-4 h-4" />,
    items: [
      {
        id: 'overview',
        label: 'Operations Overview',
        icon: <Activity className="w-4 h-4" />
      }
    ]
  },

  {
    id: 'intake',
    title: 'Intake & Workflow',
    icon: <ClipboardList className="w-4 h-4" />,
    items: [
      {
        id: 'intake_queue',
        label: 'Intake Queue',
        icon: <ClipboardList className="w-4 h-4" />
      },
      {
        id: 'reports',
        label: 'Executive Reports',
        icon: <FileText className="w-4 h-4" />
      },
      {
        id: 'alerts',
        label: 'Critical Alerts',
        icon: <AlertTriangle className="w-4 h-4" />
      }
    ]
  },

  {
    id: 'governance',
    title: 'Governance',
    icon: <Landmark className="w-4 h-4" />,
    items: [
      {
        id: 'elections',
        label: 'Elections',
        icon: <Crown className="w-4 h-4" />
      },
      {
        id: 'proposals',
        label: 'Proposals',
        icon: <FileText className="w-4 h-4" />
      }
    ]
  },

  {
    id: 'community',
    title: 'Community',
    icon: <Building2 className="w-4 h-4" />,
    items: [
      {
        id: 'neighbors',
        label: 'Neighbors',
        icon: <Users className="w-4 h-4" />
      },
      {
        id: 'partners',
        label: 'Empire Partners',
        icon: <Network className="w-4 h-4" />
      },
      {
        id: 'ads',
        label: 'Promo Ads',
        icon: <Bell className="w-4 h-4" />
      }
    ]
  },

  {
    id: 'administration',
    title: 'Administration',
    icon: <Briefcase className="w-4 h-4" />,
    items: [
      {
        id: 'staff',
        label: 'Staff Management',
        icon: <Users className="w-4 h-4" />
      }
    ]
  }
]