import './App.css';
import AssignRoles from './AssignRoles';
import Home from './Home';
import AddBattery from './AddBattery';
import Supply from './Supply'
import Track from './Track'
import { BrowserRouter as Router, Switch, Route } from "react-router-dom"

function App() {
  return (
    <div className="App">
      <Router>
        <Switch>
          <Route path="/" exact component={Home} />
          <Route path="/roles" component={AssignRoles} />
          <Route path="/addbattery" component={AddBattery} />
          <Route path="/supply" component={Supply} />
          <Route path="/track/:id?" component={Track} />
        </Switch>
      </Router>
    </div>
  );
}

export default App;
